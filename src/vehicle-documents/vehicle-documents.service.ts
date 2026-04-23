import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestScope } from '../common/request-scope';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateVehicleDocumentDto,
  DocumentOwnerTypeDto,
} from './dto/create-vehicle-document.dto';
import { UpdateVehicleDocumentDto } from './dto/update-vehicle-document.dto';

type DocumentOwnerType = 'VEHICLE' | 'DRIVER' | 'GENERAL';

@Injectable()
export class VehicleDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly includeRelations = {
    company: {
      select: {
        id: true,
        name: true,
      },
    },
    vehicle: {
      include: {
        branch: true,
      },
    },
    driver: {
      include: {
        vehicle: {
          include: {
            branch: true,
          },
        },
      },
    },
  } as const;

  async create(dto: CreateVehicleDocumentDto) {
    const payload = await this.buildPersistencePayload(dto);

    return (this.prisma as any).vehicleDocument.create({
      data: payload,
      include: this.includeRelations,
    });
  }

  async findAll() {
    return (this.prisma as any).vehicleDocument.findMany({
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'desc' }],
      include: this.includeRelations,
    });
  }

  async findOne(id: string) {
    const item = await (this.prisma as any).vehicleDocument.findUnique({
      where: { id },
      include: this.includeRelations,
    });

    if (!item) throw new NotFoundException('Documento nao encontrado');
    return item;
  }

  async update(id: string, dto: UpdateVehicleDocumentDto) {
    const existing = await this.findOne(id);

    if (!dto || Object.keys(dto).length === 0) {
      throw new BadRequestException('Envie ao menos um campo para atualizar.');
    }

    const payload = await this.buildPersistencePayload(
      {
        type: dto.type ?? existing.type,
        ownerType: dto.ownerType ?? existing.ownerType,
        name: dto.name ?? existing.name,
        number:
          dto.number !== undefined ? dto.number : (existing.number ?? undefined),
        issueDate:
          dto.issueDate !== undefined
            ? dto.issueDate
            : this.toDateInput(existing.issueDate),
        expiryDate:
          dto.expiryDate !== undefined
            ? dto.expiryDate
            : this.toDateInput(existing.expiryDate),
        status: dto.status ?? existing.status,
        issuer:
          dto.issuer !== undefined ? dto.issuer : (existing.issuer ?? undefined),
        notes:
          dto.notes !== undefined ? dto.notes : (existing.notes ?? undefined),
        fileUrl:
          dto.fileUrl !== undefined
            ? dto.fileUrl
            : (existing.fileUrl ?? undefined),
        vehicleId:
          dto.vehicleId !== undefined
            ? dto.vehicleId
            : (existing.vehicleId ?? undefined),
        driverId:
          dto.driverId !== undefined
            ? dto.driverId
            : (existing.driverId ?? undefined),
      },
      existing.companyId,
    );

    return (this.prisma as any).vehicleDocument.update({
      where: { id },
      data: payload,
      include: this.includeRelations,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await (this.prisma as any).vehicleDocument.delete({ where: { id } });
    return { message: 'Documento removido com sucesso' };
  }

  private async buildPersistencePayload(
    dto: {
      type: string;
      ownerType?: string;
      name: string;
      number?: string;
      issueDate?: string;
      expiryDate?: string;
      status?: string;
      issuer?: string;
      notes?: string;
      fileUrl?: string;
      vehicleId?: string;
      driverId?: string;
    },
    fallbackCompanyId?: string,
  ) {
    const ownerType = this.normalizeOwnerType(dto.ownerType);
    const companyId = await this.resolveCompanyId(
      ownerType,
      dto.vehicleId,
      dto.driverId,
      fallbackCompanyId,
    );
    const isCpfDocument = dto.type === 'CPF_DOCUMENT';

    return {
      type: dto.type,
      ownerType,
      name: dto.name,
      ...(dto.number !== undefined ? { number: dto.number || null } : {}),
      ...(dto.issueDate !== undefined
        ? { issueDate: isCpfDocument ? null : dto.issueDate ? new Date(dto.issueDate) : null }
        : {}),
      ...(dto.expiryDate !== undefined
        ? { expiryDate: isCpfDocument ? null : dto.expiryDate ? new Date(dto.expiryDate) : null }
        : {}),
      status: dto.status ?? 'VALID',
      ...(dto.issuer !== undefined ? { issuer: dto.issuer || null } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
      ...(dto.fileUrl !== undefined ? { fileUrl: dto.fileUrl || null } : {}),
      companyId,
      vehicleId: ownerType === 'VEHICLE' ? dto.vehicleId || null : null,
      driverId: ownerType === 'DRIVER' ? dto.driverId || null : null,
    };
  }

  private normalizeOwnerType(value?: string) {
    const normalized = String(value || DocumentOwnerTypeDto.VEHICLE)
      .trim()
      .toUpperCase();

    if (
      normalized !== 'VEHICLE' &&
      normalized !== 'DRIVER' &&
      normalized !== 'GENERAL'
    ) {
      throw new BadRequestException('Tipo de vínculo do documento inválido.');
    }

    return normalized as DocumentOwnerType;
  }

  private async resolveCompanyId(
    ownerType: DocumentOwnerType,
    vehicleId?: string,
    driverId?: string,
    fallbackCompanyId?: string,
  ) {
    if (ownerType === 'VEHICLE') {
      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id: String(vehicleId || '').trim() },
        select: { id: true, companyId: true },
      });

      if (!vehicle) {
        throw new NotFoundException('Veiculo nao encontrado');
      }

      return vehicle.companyId;
    }

    if (ownerType === 'DRIVER') {
      const driver = await (this.prisma as any).driver.findUnique({
        where: { id: String(driverId || '').trim() },
        select: {
          id: true,
          vehicle: {
            select: {
              companyId: true,
            },
          },
        },
      });

      if (!driver) {
        throw new NotFoundException('Motorista nao encontrado');
      }

      if (driver.vehicle?.companyId) {
        return driver.vehicle.companyId as string;
      }

      const scopedCompanyId = this.resolveScopedCompanyId(fallbackCompanyId);
      if (!scopedCompanyId) {
        throw new BadRequestException(
          'Selecione uma empresa para cadastrar documentos de motorista sem veiculo vinculado.',
        );
      }

      return scopedCompanyId;
    }

    const scopedCompanyId = this.resolveScopedCompanyId(fallbackCompanyId);
    if (!scopedCompanyId) {
      throw new BadRequestException(
        'Selecione uma empresa para cadastrar documentos gerais.',
      );
    }

    return scopedCompanyId;
  }

  private resolveScopedCompanyId(fallbackCompanyId?: string) {
    return (
      String(RequestScope.getCompanyId() || '').trim() ||
      String(fallbackCompanyId || '').trim() ||
      undefined
    );
  }

  private toDateInput(value?: Date | string | null) {
    if (!value) return undefined;
    return String(value).slice(0, 10);
  }
}
