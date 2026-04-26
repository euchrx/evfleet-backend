import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmergencySheetTemplate } from './templates/emergency-sheet.template';
import { MdfeTemplate } from './templates/mdfe.template';
import { MdfeService } from 'src/mdfe/mdfe.service';

type GeneratedTripDocumentType = 'EMERGENCY_SHEET' | 'MDFE_MOCK';

type ProductWithFispq = {
  dangerousProduct: {
    name: string;
    fispqUrl?: string | null;
  };
};

@Injectable()
export class GeneratedDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mdfeService: MdfeService,
  ) { }

  private async ensureDocumentNotGenerated(
    tripId: string,
    type: GeneratedTripDocumentType,
  ) {
    const existing = await this.prisma.tripGeneratedDocument.findFirst({
      where: {
        tripId,
        type,
        status: {
          in: ['GENERATED', 'SENT'],
        },
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new BadRequestException(
        type === 'EMERGENCY_SHEET'
          ? 'Ficha de emergência já foi gerada para esta viagem.'
          : 'MDF-e já foi gerado para esta viagem.',
      );
    }
  }

  private ensureProductsHaveFispq(products: ProductWithFispq[]) {
    const productsWithoutFispq = products.filter(
      (item) => !String(item.dangerousProduct?.fispqUrl || '').trim(),
    );

    if (productsWithoutFispq.length > 0) {
      throw new BadRequestException(
        `Não é possível gerar documentos. Produto(s) sem FISPQ: ${productsWithoutFispq
          .map((item) => item.dangerousProduct.name)
          .join(', ')}.`,
      );
    }
  }

  async generateEmergencySheet(tripId: string) {
    await this.ensureDocumentNotGenerated(tripId, 'EMERGENCY_SHEET');

    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        company: true,
        vehicle: true,
        driver: true,
        products: {
          include: {
            dangerousProduct: true,
          },
        },
      },
    });

    if (!trip) {
      throw new NotFoundException('Viagem não encontrada');
    }

    if (!trip.products || trip.products.length === 0) {
      throw new BadRequestException(
        'Não é possível gerar ficha de emergência sem produtos vinculados à viagem.',
      );
    }

    this.ensureProductsHaveFispq(trip.products);

    const template = new EmergencySheetTemplate();

    const html = template.render({
      trip,
      company: trip.company,
      vehicle: trip.vehicle,
      driver: trip.driver,
      products: trip.products,
    });

    return this.prisma.tripGeneratedDocument.create({
      data: {
        tripId,
        type: 'EMERGENCY_SHEET',
        status: 'GENERATED',
        payload: { html },
        generatedAt: new Date(),
      },
    });
  }

  async generateMdfeMock(tripId: string) {
    await this.ensureDocumentNotGenerated(tripId, 'MDFE_MOCK');

    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        vehicle: true,
        driver: true,
        products: {
          include: {
            dangerousProduct: true,
          },
        },
      },
    });

    if (!trip) {
      throw new NotFoundException('Viagem não encontrada');
    }

    if (!trip.products.length) {
      throw new BadRequestException(
        'Não é possível gerar MDF-e sem produtos vinculados à viagem.',
      );
    }

    this.ensureProductsHaveFispq(trip.products);

    const template = new MdfeTemplate();

    const payload = template.buildPayload({
      trip,
      vehicle: trip.vehicle,
      driver: trip.driver,
      products: trip.products,
    });


    if (!trip.companyId) {
      throw new BadRequestException(
        'Viagem sem empresa vinculada. Não é possível gerar MDF-e.',
      );
    }

    const result = await this.mdfeService.generate(tripId, trip.companyId);

    return this.prisma.tripGeneratedDocument.create({
      data: {
        tripId,
        type: 'MDFE_MOCK',
        status: result.status === 'AUTHORIZED' ? 'GENERATED' : 'ERROR',
        payload: {
          draftPayload: payload,
          providerResult: result,
        } as Prisma.InputJsonValue,
        fileUrl: result.pdfUrl ?? result.xmlUrl ?? null,
        errorMessage: result.rejectionReason ?? null,
        generatedAt: new Date(),
      },
    });
  }

  async generateMdfe(tripId: string) {
    return this.generateMdfeMock(tripId);
  }
}