import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  private static readonly AUTO_CNH_ISSUER = 'DETRAN';

  private static readonly AUTO_DRIVER_DOCUMENT_DEFINITIONS: Array<{
    type: DocumentType;
    name: string;
  }> = [
    { type: DocumentType.CNH, name: 'CNH' },
    { type: DocumentType.EAR, name: 'EAR' },
    { type: DocumentType.TOXICOLOGICAL_EXAM, name: 'Exame toxicológico' },
    { type: DocumentType.RG, name: 'RG' },
    { type: DocumentType.CPF_DOCUMENT, name: 'CPF' },
    { type: DocumentType.EMPLOYMENT_RECORD, name: 'Ficha de registro' },
  ];

  private readonly includeVehicle = {
    vehicle: {
      include: {
        branch: true,
        costCenter: true,
      },
    },
  } as const;

  async create(dto: CreateDriverDto) {
    const prisma = this.prisma as any;
    const companyId = dto.companyId;

    if (!companyId) {
      throw new BadRequestException('Empresa não identificada para cadastrar o motorista.');
    }

    if (dto.vehicleId) {
      await this.ensureVehicleBelongsToCompany(dto.vehicleId, companyId);
    }

    try {
      return await prisma.$transaction(async (tx: any) => {
        const driver = await tx.driver.create({
          data: {
            name: dto.name,
            cpf: dto.cpf,
            cnh: dto.cnh,
            cnhCategory: dto.cnhCategory,
            cnhExpiresAt: new Date(dto.cnhExpiresAt),
            phone: dto.phone ?? null,
            status: dto.status,
            companyId,
            vehicleId: dto.vehicleId || null,
          },
          include: this.includeVehicle,
        });

        await this.ensureDefaultDriverDocuments(tx, {
          driverId: driver.id,
          companyId,
        });

        await this.syncDriverCnhDocument(tx, {
          driverId: driver.id,
          companyId,
          cnh: driver.cnh,
          cnhExpiresAt: driver.cnhExpiresAt,
        });

        return driver;
      });
    } catch (error: any) {
      this.handleUniqueConstraint(error);
      throw error;
    }
  }

  async findAll() {
    const prisma = this.prisma as any;

    return prisma.driver.findMany({
      orderBy: { createdAt: 'desc' },
      include: this.includeVehicle,
    });
  }

  async findOne(id: string) {
    const prisma = this.prisma as any;

    const driver = await prisma.driver.findUnique({
      where: { id },
      include: this.includeVehicle,
    });

    if (!driver) throw new NotFoundException('Motorista nao encontrado');

    return driver;
  }

  async update(id: string, dto: UpdateDriverDto) {
    const prisma = this.prisma as any;
    const existingDriver = await this.findOne(id);

    if (!dto || Object.keys(dto).length === 0) {
      throw new BadRequestException('Envie ao menos um campo para atualizar.');
    }

    const companyId = dto.companyId || existingDriver.companyId;

    if (!companyId) {
      throw new BadRequestException('Empresa não identificada para atualizar o motorista.');
    }

    if (dto.vehicleId) {
      await this.ensureVehicleBelongsToCompany(dto.vehicleId, companyId);
    }

    try {
      return await prisma.$transaction(async (tx: any) => {
        const driver = await tx.driver.update({
          where: { id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.cpf !== undefined ? { cpf: dto.cpf } : {}),
            ...(dto.cnh !== undefined ? { cnh: dto.cnh } : {}),
            ...(dto.cnhCategory !== undefined ? { cnhCategory: dto.cnhCategory } : {}),
            ...(dto.cnhExpiresAt !== undefined
              ? { cnhExpiresAt: new Date(dto.cnhExpiresAt) }
              : {}),
            ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
            ...(dto.status !== undefined ? { status: dto.status } : {}),
            ...(dto.companyId !== undefined ? { companyId: dto.companyId } : {}),
            ...(dto.vehicleId !== undefined ? { vehicleId: dto.vehicleId || null } : {}),
          },
          include: this.includeVehicle,
        });

        await this.ensureDefaultDriverDocuments(tx, {
          driverId: driver.id,
          companyId,
        });

        await this.syncDriverCnhDocument(tx, {
          driverId: driver.id,
          companyId,
          cnh: driver.cnh,
          cnhExpiresAt: driver.cnhExpiresAt,
        });

        return driver;
      });
    } catch (error: any) {
      this.handleUniqueConstraint(error);
      throw error;
    }
  }

  async remove(id: string) {
    const prisma = this.prisma as any;

    await this.findOne(id);
    await prisma.driver.delete({ where: { id } });

    return { message: 'Motorista removido com sucesso' };
  }

  private async ensureVehicleBelongsToCompany(vehicleId: string, companyId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, companyId: true },
    });

    if (!vehicle) throw new NotFoundException('Veiculo nao encontrado');

    if (vehicle.companyId !== companyId) {
      throw new BadRequestException('O veículo informado não pertence à empresa do motorista.');
    }

    return vehicle;
  }

  private async ensureDefaultDriverDocuments(
    tx: any,
    input: { driverId: string; companyId: string },
  ) {
    const existingDocuments = await tx.vehicleDocument.findMany({
      where: {
        ownerType: 'DRIVER',
        driverId: input.driverId,
        type: {
          in: DriversService.AUTO_DRIVER_DOCUMENT_DEFINITIONS.map((item) => item.type),
        },
      },
      select: {
        type: true,
      },
    });

    const existingTypes = new Set<string>(
      existingDocuments.map((item: { type: string }) => item.type),
    );

    const documentsToCreate = DriversService.AUTO_DRIVER_DOCUMENT_DEFINITIONS.filter(
      (item) => !existingTypes.has(item.type),
    );

    if (documentsToCreate.length === 0) {
      return;
    }

    await tx.vehicleDocument.createMany({
      data: documentsToCreate.map((item) => ({
        type: item.type,
        ownerType: 'DRIVER',
        name: item.name,
        status: 'VALID',
        companyId: input.companyId,
        driverId: input.driverId,
      })),
    });
  }

  private async syncDriverCnhDocument(
    tx: any,
    input: {
      driverId: string;
      companyId: string;
      cnh: string;
      cnhExpiresAt: Date | string;
    },
  ) {
    const existing = await tx.vehicleDocument.findFirst({
      where: {
        ownerType: 'DRIVER',
        type: 'CNH',
        driverId: input.driverId,
      },
      select: {
        id: true,
        status: true,
        fileUrl: true,
        notes: true,
      },
    });

    const payload = {
      type: 'CNH',
      ownerType: 'DRIVER',
      name: 'CNH',
      number: input.cnh,
      expiryDate: new Date(input.cnhExpiresAt),
      issuer: DriversService.AUTO_CNH_ISSUER,
      companyId: input.companyId,
      driverId: input.driverId,
    };

    if (existing) {
      await tx.vehicleDocument.update({
        where: { id: existing.id },
        data: {
          ...payload,
          status: existing.status ?? 'VALID',
          fileUrl: existing.fileUrl ?? null,
          notes: existing.notes ?? null,
        },
      });

      return;
    }

    await tx.vehicleDocument.create({
      data: {
        ...payload,
        status: 'VALID',
      },
    });
  }

  private handleUniqueConstraint(error: any) {
    if (error?.code !== 'P2002') return;

    const target = Array.isArray(error?.meta?.target)
      ? (error.meta.target as string[])
      : [];

    if (target.includes('cpf')) {
      throw new ConflictException('CPF já cadastrado.');
    }

    if (target.includes('cnh')) {
      throw new ConflictException('CNH já cadastrada.');
    }

    throw new ConflictException('Registro duplicado. Verifique os dados informados.');
  }
}