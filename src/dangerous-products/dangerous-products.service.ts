import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDangerousProductDto } from './dto/create-dangerous-product.dto';
import { UpdateDangerousProductDto } from './dto/update-dangerous-product.dto';

type CompanyContext = {
  companyId: string;
};

@Injectable()
export class DangerousProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(context: CompanyContext, dto: CreateDangerousProductDto) {
    if ((dto.active ?? true) && !dto.fispqUrl?.trim()) {
      throw new BadRequestException(
        'FISPQ é obrigatória para cadastrar produto perigoso ativo.',
      );
    }

    return this.prisma.dangerousProduct.create({
      data: {
        companyId: context.companyId,
        name: dto.name.trim(),
        commercialName: dto.commercialName?.trim() || null,
        unNumber: dto.unNumber.trim(),
        riskClass: dto.riskClass.trim(),
        packingGroup: dto.packingGroup?.trim() || null,
        hazardNumber: dto.hazardNumber?.trim() || null,
        emergencyNumber: dto.emergencyNumber?.trim() || null,
        physicalState: dto.physicalState?.trim() || null,
        emergencyInstructions:
          dto.emergencyInstructions === undefined
            ? undefined
            : (dto.emergencyInstructions as Prisma.InputJsonValue),
        fispqUrl: dto.fispqUrl.trim(),
        active: dto.active ?? true,
      },
    });
  }

  async findAll(context: CompanyContext) {
    return this.prisma.dangerousProduct.findMany({
      where: {
        companyId: context.companyId,
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  async findActive(context: CompanyContext) {
    return this.prisma.dangerousProduct.findMany({
      where: {
        companyId: context.companyId,
        active: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(context: CompanyContext, id: string) {
    const product = await this.prisma.dangerousProduct.findFirst({
      where: {
        id,
        companyId: context.companyId,
      },
    });

    if (!product) {
      throw new NotFoundException('Produto perigoso não encontrado.');
    }

    return product;
  }

  async update(
    context: CompanyContext,
    id: string,
    dto: UpdateDangerousProductDto,
  ) {
    const current = await this.findOne(context, id);

    const nextActive = dto.active ?? current.active;
    const nextFispqUrl =
      dto.fispqUrl === undefined ? current.fispqUrl : dto.fispqUrl;

    if (nextActive && !nextFispqUrl?.trim()) {
      throw new BadRequestException(
        'FISPQ é obrigatória para manter produto perigoso ativo.',
      );
    }

    return this.prisma.dangerousProduct.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        commercialName:
          dto.commercialName === undefined
            ? undefined
            : dto.commercialName?.trim() || null,
        unNumber: dto.unNumber?.trim(),
        riskClass: dto.riskClass?.trim(),
        packingGroup:
          dto.packingGroup === undefined
            ? undefined
            : dto.packingGroup?.trim() || null,
        hazardNumber:
          dto.hazardNumber === undefined
            ? undefined
            : dto.hazardNumber?.trim() || null,
        emergencyNumber:
          dto.emergencyNumber === undefined
            ? undefined
            : dto.emergencyNumber?.trim() || null,
        physicalState:
          dto.physicalState === undefined
            ? undefined
            : dto.physicalState?.trim() || null,
        emergencyInstructions:
          dto.emergencyInstructions === undefined
            ? undefined
            : (dto.emergencyInstructions as Prisma.InputJsonValue),
        fispqUrl:
          dto.fispqUrl === undefined ? undefined : dto.fispqUrl.trim(),
        active: dto.active,
      },
    });
  }

  async remove(context: CompanyContext, id: string) {
    await this.findOne(context, id);

    const linkedToTrips = await this.prisma.tripProduct.count({
      where: {
        dangerousProductId: id,
      },
    });

    if (linkedToTrips > 0) {
      return this.prisma.dangerousProduct.update({
        where: { id },
        data: { active: false },
      });
    }

    return this.prisma.dangerousProduct.delete({
      where: { id },
    });
  }
}