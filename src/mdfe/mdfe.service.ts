import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MDFE_PROVIDER } from './mdfe.constants';
import type {
  MdfeProvider,
  MdfeProviderStatus,
} from 'src/integrations/mdfe/mdfe-provider.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import { DamdfeService } from './damdfe.service';

@Injectable()
export class MdfeService {
  constructor(
    private readonly prisma: PrismaService,

    @Inject(MDFE_PROVIDER)
    private readonly mdfeProvider: MdfeProvider,

    private readonly damdfeService: DamdfeService,
  ) { }

  async generate(tripId: string, companyId: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
    });

    if (!trip) {
      throw new NotFoundException('Viagem não encontrada.');
    }

    if (!trip.companyId) {
      throw new BadRequestException(
        'Viagem sem empresa vinculada. Não é possível gerar MDF-e.',
      );
    }

    if (trip.companyId !== companyId) {
      throw new BadRequestException(
        'A viagem não pertence à empresa do usuário autenticado.',
      );
    }

    const existing = await this.prisma.mdfe.findUnique({
      where: { tripId },
    });

    if (
      existing &&
      ['AUTHORIZED', 'PROCESSING', 'CLOSED', 'CANCELED'].includes(
        existing.status,
      )
    ) {
      throw new BadRequestException(
        'Já existe MDF-e em processamento, autorizado, encerrado ou cancelado para esta viagem.',
      );
    }

    const fiscal = await this.prisma.companyFiscalSettings.findUnique({
      where: { companyId },
    });

    if (!fiscal) {
      throw new BadRequestException('Configuração fiscal não encontrada.');
    }

    if (!fiscal.cnpj || !fiscal.state || !fiscal.cityIbgeCode) {
      throw new BadRequestException(
        'Configuração fiscal incompleta. Verifique CNPJ, UF e código IBGE do município.',
      );
    }

    const mdfe = await this.prisma.mdfe.upsert({
      where: { tripId },
      create: {
        tripId,
        companyId,
        environment: fiscal.mdfeEnvironment,
        series: fiscal.mdfeSeries,
        number: fiscal.mdfeNextNumber,
        status: 'PROCESSING',
      },
      update: {
        environment: fiscal.mdfeEnvironment,
        series: fiscal.mdfeSeries,
        status: 'PROCESSING',
        rejectionCode: null,
        rejectionReason: null,
      },
    });

    const result = await this.mdfeProvider.issue({ tripId });

    if (result.status === 'AUTHORIZED') {
      await this.prisma.mdfe.update({
        where: { id: mdfe.id },
        data: {
          status: 'AUTHORIZED',
          accessKey: result.accessKey,
          protocol: result.protocol,
          requestXml: result.requestXml ?? null,
          authorizedXml: result.authorizedXml ?? null,
          responseXml: this.normalizeXml(
            result.responseXml ?? result.rawResponse,
          ),
          rejectionCode: null,
          rejectionReason: null,
          issuedAt: new Date(),
        },
      });

      await this.prisma.companyFiscalSettings.update({
        where: { companyId },
        data: {
          mdfeNextNumber: { increment: 1 },
        },
      });

      return result;
    }

    if (result.status === 'REJECTED') {
      await this.prisma.mdfe.update({
        where: { id: mdfe.id },
        data: {
          status: 'REJECTED',
          requestXml: result.requestXml ?? null,
          responseXml: this.normalizeXml(
            result.responseXml ?? result.rawResponse,
          ),
          rejectionCode: result.rejectionCode ?? null,
          rejectionReason: result.rejectionReason ?? null,
        },
      });

      return result;
    }

    await this.prisma.mdfe.update({
      where: { id: mdfe.id },
      data: {
        status: this.mapProviderStatusToMdfeStatus(result.status),
        requestXml: result.requestXml ?? null,
        responseXml: this.normalizeXml(result.responseXml ?? result.rawResponse),
        rejectionCode: result.rejectionCode ?? null,
        rejectionReason: result.rejectionReason ?? null,
      },
    });

    return result;
  }

  async consult(tripId: string, companyId: string) {
    const mdfe = await this.findMdfeByTripAndCompany(tripId, companyId);

    if (!mdfe.accessKey) {
      throw new BadRequestException('MDF-e ainda não possui chave de acesso.');
    }

    const result = await this.mdfeProvider.getStatus(mdfe.accessKey);

    const updated = await this.prisma.mdfe.update({
      where: { id: mdfe.id },
      data: {
        status: this.mapProviderStatusToMdfeStatus(result.status),
        protocol: result.protocol ?? mdfe.protocol,
        responseXml: this.normalizeXml(result.responseXml ?? result.rawResponse),
        rejectionCode: result.rejectionCode ?? null,
        rejectionReason: result.rejectionReason ?? null,
        closedAt: result.status === 'CLOSED' ? new Date() : mdfe.closedAt,
        canceledAt: result.status === 'CANCELED' ? new Date() : mdfe.canceledAt,
      },
    });

    return {
      id: updated.id,
      tripId: updated.tripId,
      status: updated.status,
      accessKey: updated.accessKey,
      protocol: updated.protocol,
      rejectionCode: updated.rejectionCode,
      rejectionReason: updated.rejectionReason,
      issuedAt: updated.issuedAt,
      closedAt: updated.closedAt,
      canceledAt: updated.canceledAt,
    };
  }

  async close(tripId: string, companyId: string) {
    const mdfe = await this.prisma.mdfe.findFirst({
      where: {
        tripId,
        companyId,
      },
      include: {
        company: {
          include: {
            fiscalSettings: true,
          },
        },
      },
    });

    if (!mdfe) {
      throw new NotFoundException('MDF-e não encontrado para esta viagem.');
    }

    if (!mdfe.accessKey) {
      throw new BadRequestException('MDF-e ainda não possui chave de acesso.');
    }

    if (mdfe.status !== 'AUTHORIZED') {
      throw new BadRequestException(
        'Somente MDF-e autorizado pode ser encerrado.',
      );
    }

    const fiscal = mdfe.company.fiscalSettings;

    if (!fiscal) {
      throw new BadRequestException('Configuração fiscal não encontrada.');
    }

    const result = await this.mdfeProvider.close({
      accessKey: mdfe.accessKey,
      state: fiscal.state,
      cityIbgeCode: fiscal.cityIbgeCode,
      closedAt: new Date(),
    });

    await this.prisma.mdfe.update({
      where: { id: mdfe.id },
      data: {
        status: this.mapProviderStatusToMdfeStatus(result.status),
        responseXml: this.normalizeXml(result.responseXml ?? result.rawResponse),
        rejectionCode: result.rejectionCode ?? null,
        rejectionReason: result.rejectionReason ?? null,
        closedAt: result.status === 'CLOSED' ? new Date() : mdfe.closedAt,
      },
    });

    return result;
  }

  async cancel(tripId: string, companyId: string, reason: string) {
    const normalizedReason = String(reason || '').trim();

    if (normalizedReason.length < 15 || normalizedReason.length > 255) {
      throw new BadRequestException(
        'O motivo do cancelamento deve ter entre 15 e 255 caracteres.',
      );
    }

    const mdfe = await this.findMdfeByTripAndCompany(tripId, companyId);

    if (!mdfe.accessKey) {
      throw new BadRequestException('MDF-e ainda não possui chave de acesso.');
    }

    if (mdfe.status !== 'AUTHORIZED') {
      throw new BadRequestException(
        'Somente MDF-e autorizado pode ser cancelado.',
      );
    }

    const result = await this.mdfeProvider.cancel({
      accessKey: mdfe.accessKey,
      reason: normalizedReason,
    });

    await this.prisma.mdfe.update({
      where: { id: mdfe.id },
      data: {
        status: this.mapProviderStatusToMdfeStatus(result.status),
        responseXml: this.normalizeXml(result.responseXml ?? result.rawResponse),
        rejectionCode: result.rejectionCode ?? null,
        rejectionReason: result.rejectionReason ?? null,
        canceledAt: result.status === 'CANCELED' ? new Date() : mdfe.canceledAt,
      },
    });

    return result;
  }

  async getByTrip(tripId: string, companyId: string) {
    return this.findMdfeByTripAndCompany(tripId, companyId);
  }

  async getXmlByTrip(tripId: string, companyId: string) {
    const mdfe = await this.findMdfeByTripAndCompany(tripId, companyId);

    const xml = mdfe.authorizedXml || mdfe.responseXml || mdfe.requestXml;

    if (!xml) {
      throw new NotFoundException('XML do MDF-e ainda não disponível.');
    }

    return {
      fileName: `mdfe-${mdfe.accessKey || mdfe.id}.xml`,
      xml,
    };
  }

  async getDamdfeByTrip(tripId: string, companyId: string) {
    const mdfe = await this.findMdfeByTripAndCompany(tripId, companyId);

    const buffer = await this.damdfeService.buildPdf({
      accessKey: mdfe.accessKey,
      protocol: mdfe.protocol,
      status: mdfe.status,
      series: mdfe.series,
      number: mdfe.number,
      issuedAt: mdfe.issuedAt,
    });

    return {
      fileName: `damdfe-${mdfe.accessKey || mdfe.id}.pdf`,
      buffer,
    };
  }

  private async findMdfeByTripAndCompany(tripId: string, companyId: string) {
    const mdfe = await this.prisma.mdfe.findFirst({
      where: {
        tripId,
        companyId,
      },
    });

    if (!mdfe) {
      throw new NotFoundException('MDF-e não encontrado para esta viagem.');
    }

    return mdfe;
  }

  private mapProviderStatusToMdfeStatus(status: MdfeProviderStatus) {
    switch (status) {
      case 'AUTHORIZED':
        return 'AUTHORIZED';
      case 'REJECTED':
        return 'REJECTED';
      case 'PROCESSING':
        return 'PROCESSING';
      case 'CANCELED':
        return 'CANCELED';
      case 'CLOSED':
        return 'CLOSED';
      case 'ERROR':
      default:
        return 'ERROR';
    }
  }

  private normalizeXml(value: unknown): string | null {
    if (!value) {
      return null;
    }

    if (typeof value === 'string') {
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }
}