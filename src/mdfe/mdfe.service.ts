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
  MdfeIssueResult,
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
    const { mdfe } = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`mdfe-number-${companyId}`}))`;

      const trip = await tx.trip.findFirst({
        where: {
          id: tripId,
          companyId,
        },
        include: {
          vehicle: true,
        },
      });

      if (!trip) {
        throw new NotFoundException('Viagem não encontrada.');
      }

      if (!trip.companyId) {
        throw new BadRequestException(
          'Viagem sem empresa vinculada. Não é possível gerar MDF-e.',
        );
      }

      const existing = await tx.mdfe.findUnique({
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

      if (trip.vehicleId) {
        const openMdfe = await tx.mdfe.findFirst({
          where: {
            companyId,
            status: {
              in: ['AUTHORIZED', 'PROCESSING'],
            },
            tripId: {
              not: tripId,
            },
            trip: {
              vehicleId: trip.vehicleId,
              destinationState: trip.destinationState,
            },
          },
          select: {
            accessKey: true,
            protocol: true,
            trip: {
              select: {
                destinationState: true,
              },
            },
          },
        });

        if (openMdfe) {
          throw new BadRequestException(
            `Existe MDF-e autorizado e não encerrado para esta placa/UF. Encerre o MDF-e ${openMdfe.accessKey || ''} antes de emitir outro.`,
          );
        }
      }

      const fiscal = await tx.companyFiscalSettings.findUnique({
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

      const nextNumber = fiscal.mdfeNextNumber;

      const mdfe = await tx.mdfe.upsert({
        where: { tripId },
        create: {
          tripId,
          companyId,
          environment: fiscal.mdfeEnvironment,
          series: fiscal.mdfeSeries,
          number: nextNumber,
          status: 'PROCESSING',
          rejectionCode: null,
          rejectionReason: null,
        },
        update: {
          environment: fiscal.mdfeEnvironment,
          series: fiscal.mdfeSeries,
          number: nextNumber,
          status: 'PROCESSING',
          rejectionCode: null,
          rejectionReason: null,
          lastEventCode: null,
          lastEventReason: null,
          lastEventAt: null,
        },
      });

      await tx.companyFiscalSettings.update({
        where: { companyId },
        data: {
          mdfeNextNumber: {
            increment: 1,
          },
        },
      });

      return { mdfe };
    });

    const result = await this.mdfeProvider.issue({ tripId });

    if (result.status === 'AUTHORIZED') {
      const updated = await this.prisma.mdfe.update({
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
          authorizedAt: result.authorizedAt ?? null,
        },
      });

      return {
        ...result,
        mdfe: this.toMdfeSummary(updated),
      };
    }

    if (result.status === 'REJECTED') {
      const updated = await this.prisma.mdfe.update({
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

      return {
        ...result,
        mdfe: this.toMdfeSummary(updated),
      };
    }

    const updated = await this.prisma.mdfe.update({
      where: { id: mdfe.id },
      data: {
        status: this.mapProviderStatusToMdfeStatus(result.status),
        requestXml: result.requestXml ?? null,
        responseXml: this.normalizeXml(result.responseXml ?? result.rawResponse),
        rejectionCode: result.rejectionCode ?? null,
        rejectionReason: result.rejectionReason ?? null,
      },
    });

    return {
      ...result,
      mdfe: this.toMdfeSummary(updated),
    };
  }

  async consult(tripId: string, companyId: string) {
    const mdfe = await this.findMdfeByTripAndCompany(tripId, companyId);

    if (!mdfe.accessKey) {
      throw new BadRequestException('MDF-e ainda não possui chave de acesso.');
    }

    const result = await this.mdfeProvider.getStatus(mdfe.accessKey);

    const mappedStatus = this.mapProviderStatusToMdfeStatus(result.status);
    const now = new Date();

    const updated = await this.prisma.mdfe.update({
      where: { id: mdfe.id },
      data: {
        status: mappedStatus,
        protocol: result.protocol ?? mdfe.protocol,
        responseXml: this.normalizeXml(result.responseXml ?? result.rawResponse),
        rejectionCode: result.rejectionCode ?? null,
        rejectionReason: result.rejectionReason ?? null,
        lastEventCode: result.rejectionCode ?? null,
        lastEventReason: result.rejectionReason ?? null,
        lastEventAt: now,
        closedAt: result.status === 'CLOSED' ? now : mdfe.closedAt,
        canceledAt: result.status === 'CANCELED' ? now : mdfe.canceledAt,
      },
    });

    await this.createMdfeEvent({
      mdfeId: mdfe.id,
      companyId,
      type: 'CONSULT',
      status: result.status === 'REJECTED' ? 'REJECTED' : 'AUTHORIZED',
      result,
    });

    return this.toMdfeSummary(updated);
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
        trip: true,
      },
    });

    if (!mdfe) {
      throw new NotFoundException('MDF-e não encontrado para esta viagem.');
    }

    if (!mdfe.accessKey) {
      throw new BadRequestException('MDF-e ainda não possui chave de acesso.');
    }

    if (!mdfe.protocol) {
      throw new BadRequestException(
        'MDF-e ainda não possui protocolo de autorização.',
      );
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

    const closeState = mdfe.trip.destinationState || fiscal.state;
    const closeCityIbgeCode =
      mdfe.trip.destinationCityIbgeCode || fiscal.cityIbgeCode;

    if (!closeState || !closeCityIbgeCode) {
      throw new BadRequestException(
        'UF e código IBGE do município de encerramento são obrigatórios.',
      );
    }

    const result = await this.mdfeProvider.close({
      accessKey: mdfe.accessKey,
      protocol: mdfe.protocol,
      state: closeState,
      cityIbgeCode: closeCityIbgeCode,
      closedAt: new Date(),
    });

    const now = new Date();

    const updated = await this.prisma.mdfe.update({
      where: { id: mdfe.id },
      data: {
        status: result.status === 'CLOSED' ? 'CLOSED' : mdfe.status,
        responseXml: this.normalizeXml(result.responseXml ?? result.rawResponse),
        rejectionCode: result.rejectionCode ?? null,
        rejectionReason: result.rejectionReason ?? null,
        lastEventCode: result.rejectionCode ?? null,
        lastEventReason: result.rejectionReason ?? null,
        lastEventAt: now,
        closedAt: result.status === 'CLOSED' ? now : mdfe.closedAt,
      },
    });

    await this.createMdfeEvent({
      mdfeId: mdfe.id,
      companyId,
      type: 'CLOSE',
      status: result.status === 'CLOSED' ? 'AUTHORIZED' : 'REJECTED',
      result,
    });

    return {
      ...result,
      mdfe: this.toMdfeSummary(updated),
    };
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

    if (!mdfe.protocol) {
      throw new BadRequestException(
        'MDF-e ainda não possui protocolo de autorização.',
      );
    }

    if (mdfe.status !== 'AUTHORIZED') {
      throw new BadRequestException(
        'Somente MDF-e autorizado pode ser cancelado.',
      );
    }

    const result = await this.mdfeProvider.cancel({
      accessKey: mdfe.accessKey,
      protocol: mdfe.protocol,
      reason: normalizedReason,
    });

    const now = new Date();

    const updated = await this.prisma.mdfe.update({
      where: { id: mdfe.id },
      data: {
        status:
          result.status === 'CANCELED'
            ? 'CANCELED'
            : this.mapProviderStatusToMdfeStatus(result.status),
        responseXml: this.normalizeXml(result.responseXml ?? result.rawResponse),
        rejectionCode: result.rejectionCode ?? null,
        rejectionReason: result.rejectionReason ?? null,
        lastEventCode: result.rejectionCode ?? null,
        lastEventReason: result.rejectionReason ?? null,
        lastEventAt: now,
        canceledAt: result.status === 'CANCELED' ? now : mdfe.canceledAt,
      },
    });

    await this.createMdfeEvent({
      mdfeId: mdfe.id,
      companyId,
      type: 'CANCEL',
      status: result.status === 'CANCELED' ? 'AUTHORIZED' : 'REJECTED',
      result,
    });

    return {
      ...result,
      mdfe: this.toMdfeSummary(updated),
    };
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

  private async createMdfeEvent(input: {
    mdfeId: string;
    companyId: string;
    type: 'CLOSE' | 'CANCEL' | 'CONSULT';
    status: 'SENT' | 'AUTHORIZED' | 'REJECTED' | 'ERROR';
    result: MdfeIssueResult;
  }) {
    await this.prisma.mdfeEvent.create({
      data: {
        mdfeId: input.mdfeId,
        companyId: input.companyId,
        type: input.type,
        status: input.status,
        eventSequence: input.type === 'CONSULT' ? null : 1,
        eventProtocol: input.result.protocol ?? null,
        eventCode: input.result.rejectionCode ?? null,
        eventReason: input.result.rejectionReason ?? null,
        eventAt: input.result.authorizedAt ?? new Date(),
        requestXml: input.result.requestXml ?? null,
        responseXml: this.normalizeXml(
          input.result.responseXml ?? input.result.rawResponse,
        ),
      },
    });
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

  private toMdfeSummary(mdfe: {
    id: string;
    tripId: string;
    status: string;
    accessKey: string | null;
    protocol: string | null;
    rejectionCode: string | null;
    rejectionReason: string | null;
    issuedAt: Date | null;
    authorizedAt?: Date | null;
    closedAt: Date | null;
    canceledAt: Date | null;
  }) {
    return {
      id: mdfe.id,
      tripId: mdfe.tripId,
      status: mdfe.status,
      accessKey: mdfe.accessKey,
      protocol: mdfe.protocol,
      rejectionCode: mdfe.rejectionCode,
      rejectionReason: mdfe.rejectionReason,
      issuedAt: mdfe.issuedAt,
      authorizedAt: mdfe.authorizedAt ?? null,
      closedAt: mdfe.closedAt,
      canceledAt: mdfe.canceledAt,
    };
  }
}
