import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

type ChangeItem = {
  field: string;
  oldValue: string | null;
  newValue: string | null;
};

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  private async resolveBranchIdForCreate(
    inputBranchId: string | undefined,
    context?: { role?: string; userCompanyId?: string; scopeCompanyId?: string },
  ) {
    const branchId = String(inputBranchId || '').trim();
    if (branchId) {
      const branchExists = await this.prisma.branch.findUnique({
        where: { id: branchId },
        select: { id: true },
      });
      if (!branchExists) throw new NotFoundException('Branch nao encontrada');
      return branchExists.id;
    }

    const role = String(context?.role || '').trim().toUpperCase();
    const companyId =
      role === 'ADMIN'
        ? String(context?.scopeCompanyId || '').trim()
        : String(context?.userCompanyId || '').trim();

    if (!companyId) {
      if (role === 'ADMIN') {
        throw new BadRequestException(
          'ADMIN sem escopo de empresa. Selecione uma empresa no escopo para continuar.',
        );
      }
      throw new BadRequestException('Usuario sem companyId vinculado.');
    }

    const firstBranch = await this.prisma.branch.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (firstBranch) return firstBranch.id;

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true },
    });

    if (!company) {
      throw new BadRequestException('Empresa vinculada nao encontrada.');
    }

    const createdBranch = await this.prisma.branch.create({
      data: {
        companyId: company.id,
        name: company.name,
        city: 'Nao informado',
        state: 'NI',
      },
      select: { id: true },
    });

    return createdBranch.id;
  }

  private withProfilePhotoUrl<T extends { id: string; profilePhoto?: { id: string } | null }>(
    vehicle: T,
  ) {
    return {
      ...vehicle,
      profilePhotoUrl: vehicle.profilePhoto ? `/vehicles/${vehicle.id}/profile-photo` : null,
    };
  }

  private normalizeText(value: string | null | undefined) {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  private async ensureUniqueVehicleFields(
    input: { plate: string; chassis?: string | null; renavam?: string | null },
    ignoreVehicleId?: string,
  ) {
    const normalizedPlate = this.normalizeText(input.plate)?.toUpperCase();
    const normalizedChassis = this.normalizeText(input.chassis)?.toUpperCase();
    const normalizedRenavam = this.normalizeText(input.renavam);

    if (!normalizedPlate) {
      throw new BadRequestException('Placa obrigatoria.');
    }

    const conflicts = await this.prisma.vehicle.findMany({
      where: {
        ...(ignoreVehicleId ? { id: { not: ignoreVehicleId } } : {}),
        OR: [
          { plate: normalizedPlate },
          ...(normalizedChassis ? [{ chassis: normalizedChassis }] : []),
          ...(normalizedRenavam ? [{ renavam: normalizedRenavam }] : []),
        ],
      },
      select: { id: true, plate: true, chassis: true, renavam: true },
      take: 5,
    });

    const duplicatedFields: string[] = [];

    if (conflicts.some((item) => item.plate === normalizedPlate)) {
      duplicatedFields.push('placa');
    }
    if (
      normalizedChassis &&
      conflicts.some((item) => (item.chassis || '').toUpperCase() === normalizedChassis)
    ) {
      duplicatedFields.push('chassi');
    }
    if (
      normalizedRenavam &&
      conflicts.some((item) => (item.renavam || '') === normalizedRenavam)
    ) {
      duplicatedFields.push('renavam');
    }

    if (duplicatedFields.length > 0) {
      throw new BadRequestException(
        `Ja existe veiculo com ${duplicatedFields.join(', ')} informado(s).`,
      );
    }
  }

  private toComparable(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (Array.isArray(value)) return JSON.stringify(value);
    return String(value);
  }

  private fieldLabel(field: string): string {
    const labels: Record<string, string> = {
      plate: 'Placa',
      model: 'Modelo',
      brand: 'Marca',
      year: 'Ano',
      vehicleType: 'Tipo de peso',
      category: 'Tipo de veiculo',
      chassis: 'Chassi',
      renavam: 'Renavam',
      acquisitionDate: 'Data de aquisicao',
      fuelType: 'Combustivel',
      tankCapacity: 'Capacidade do tanque',
      status: 'Status',
      branchId: 'Filial',
      photoUrls: 'Fotos',
      documentUrls: 'Documentos',
    };

    return labels[field] || field;
  }

  private buildChangeLog(current: any, dto: UpdateVehicleDto): ChangeItem[] {
    const rawChanges: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];

    for (const key of Object.keys(dto)) {
      if (key === 'branchId') {
        rawChanges.push({ field: key, oldValue: current.branchId, newValue: dto.branchId });
        continue;
      }

      if (key === 'acquisitionDate') {
        rawChanges.push({
          field: key,
          oldValue: current.acquisitionDate,
          newValue: dto.acquisitionDate ? new Date(dto.acquisitionDate) : null,
        });
        continue;
      }

      rawChanges.push({
        field: key,
        oldValue: current[key],
        newValue: (dto as any)[key],
      });
    }

    return rawChanges
      .map((change) => ({
        field: change.field,
        oldValue: this.toComparable(change.oldValue),
        newValue: this.toComparable(change.newValue),
      }))
      .filter((change) => change.oldValue !== change.newValue);
  }

  async create(
    dto: CreateVehicleDto,
    context?: { role?: string; userCompanyId?: string; scopeCompanyId?: string },
  ) {
    const resolvedBranchId = await this.resolveBranchIdForCreate(dto.branchId, context);

    const plate = this.normalizeText(dto.plate)?.toUpperCase() || '';
    const chassis = this.normalizeText(dto.chassis)?.toUpperCase() || null;
    const renavam = this.normalizeText(dto.renavam) || null;

    await this.ensureUniqueVehicleFields({ plate, chassis, renavam });

    try {
      const vehicle = await this.prisma.vehicle.create({
        data: {
          plate,
          model: dto.model,
          brand: dto.brand,
          year: dto.year,
          vehicleType: dto.vehicleType,
          category: dto.category,
          chassis,
          renavam,
          acquisitionDate: dto.acquisitionDate ? new Date(dto.acquisitionDate) : null,
          fuelType: dto.fuelType,
          tankCapacity: dto.tankCapacity,
          status: dto.status ?? 'ACTIVE',
          photoUrls: dto.photoUrls ?? [],
          documentUrls: dto.documentUrls ?? [],
          branch: { connect: { id: resolvedBranchId } },
        },
        include: { branch: true, costCenter: true, profilePhoto: { select: { id: true } } },
      });
      return this.withProfilePhotoUrl(vehicle);
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const target = Array.isArray(error?.meta?.target)
          ? String(error.meta.target[0] || '')
          : String(error?.meta?.target || '');

        if (/plate/i.test(target)) {
          throw new BadRequestException('Ja existe veiculo com placa informada.');
        }
        if (/chassis/i.test(target)) {
          throw new BadRequestException('Ja existe veiculo com chassi informado.');
        }
        if (/renavam/i.test(target)) {
          throw new BadRequestException('Ja existe veiculo com renavam informado.');
        }

        throw new BadRequestException(
          'Nao foi possivel salvar: placa, chassi ou renavam ja cadastrado.',
        );
      }
      throw error;
    }
  }

  async findAll(params: {
    branchId?: string;
    vehicleType?: 'LIGHT' | 'HEAVY';
    plate?: string;
    page: number;
    limit: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.branchId) where.branchId = params.branchId;
    if (params.vehicleType) where.vehicleType = params.vehicleType;
    if (params.plate) where.plate = { contains: params.plate, mode: 'insensitive' };

    const [total, items] = await Promise.all([
      this.prisma.vehicle.count({ where }),
      this.prisma.vehicle.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { branch: true, costCenter: true, profilePhoto: { select: { id: true } } },
      }),
    ]);

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      items: items.map((item) => this.withProfilePhotoUrl(item)),
    };
  }

  async findOne(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: { branch: true, costCenter: true, profilePhoto: { select: { id: true } } },
    });

    if (!vehicle) throw new NotFoundException('Vehicle nao encontrado');
    return this.withProfilePhotoUrl(vehicle);
  }

  async getHistory(id: string, page = 1, limit = 10) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: {
        branch: true,
        maintenanceRecords: true,
        fuelRecords: true,
        debts: true,
        maintenancePlans: true,
        changeLogs: true,
      },
    });

    if (!vehicle) throw new NotFoundException('Vehicle nao encontrado');

    const history = [
      {
        date: vehicle.createdAt,
        type: 'VEHICLE_CREATED',
        title: 'Veiculo cadastrado',
        description: `${vehicle.plate} (${vehicle.brand} ${vehicle.model})`,
      },
      ...vehicle.changeLogs.map((log) => ({
        date: log.changedAt,
        type: 'VEHICLE_EDIT',
        title: 'Veiculo editado',
        description: `${this.fieldLabel(log.field)}: ${log.oldValue ?? '-'} > ${log.newValue ?? '-'}`,
      })),
      ...vehicle.maintenanceRecords.map((record) => ({
        date: record.maintenanceDate,
        type: 'MAINTENANCE',
        title: record.description,
        description: `${record.type} | ${record.status} | R$ ${record.cost.toFixed(2)}`,
      })),
      ...vehicle.fuelRecords.map((fuel) => ({
        date: fuel.fuelDate,
        type: 'FUEL',
        title: 'Abastecimento',
        description: `${fuel.liters.toFixed(2)}L | R$ ${fuel.totalValue.toFixed(2)} | ${fuel.station}`,
      })),
      ...vehicle.debts.map((debt) => ({
        date: debt.debtDate,
        type: 'DEBT',
        title: debt.description,
        description: `R$ ${debt.amount.toFixed(2)} | ${debt.points} pontos | ${debt.status}`,
      })),
      ...vehicle.maintenancePlans.map((plan) => ({
        date: plan.createdAt,
        type: 'MAINTENANCE_PLAN',
        title: `Plano: ${plan.name}`,
        description: `${plan.planType} | a cada ${plan.intervalValue} ${plan.intervalUnit}`,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const safePage = Math.max(1, page || 1);
    const safeLimit = Math.min(100, Math.max(1, limit || 10));
    const total = history.length;
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));
    const start = (safePage - 1) * safeLimit;
    const items = history.slice(start, start + safeLimit);

    return {
      vehicle,
      history: items,
      page: safePage,
      limit: safeLimit,
      total,
      totalPages,
    };
  }

  async update(id: string, dto: UpdateVehicleDto) {
    const current = await this.prisma.vehicle.findUnique({
      where: { id },
    });

    if (!current) throw new NotFoundException('Vehicle nao encontrado');

    if (!dto || Object.keys(dto).length === 0) {
      throw new BadRequestException('Envie ao menos um campo para atualizar.');
    }

    if (dto.branchId) {
      const exists = await this.prisma.branch.findUnique({
        where: { id: dto.branchId },
        select: { id: true },
      });

      if (!exists) throw new NotFoundException('Branch nao encontrada');
    }

    const { branchId, acquisitionDate, ...scalar } = dto;
    const nextPlate =
      dto.plate !== undefined
        ? this.normalizeText(dto.plate)?.toUpperCase() || ''
        : current.plate;
    const nextChassis =
      dto.chassis !== undefined
        ? this.normalizeText(dto.chassis)?.toUpperCase() || null
        : current.chassis;
    const nextRenavam =
      dto.renavam !== undefined
        ? this.normalizeText(dto.renavam) || null
        : current.renavam;

    await this.ensureUniqueVehicleFields(
      { plate: nextPlate, chassis: nextChassis, renavam: nextRenavam },
      id,
    );

    const changes = this.buildChangeLog(current, dto);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.vehicle.update({
          where: { id },
          data: {
            ...scalar,
            ...(dto.plate !== undefined ? { plate: nextPlate } : {}),
            ...(dto.chassis !== undefined ? { chassis: nextChassis } : {}),
            ...(dto.renavam !== undefined ? { renavam: nextRenavam } : {}),
            ...(dto.acquisitionDate !== undefined
              ? { acquisitionDate: acquisitionDate ? new Date(acquisitionDate) : null }
              : {}),
            ...(branchId ? { branch: { connect: { id: branchId } } } : {}),
          },
          include: { branch: true, costCenter: true, profilePhoto: { select: { id: true } } },
        });

        if (changes.length > 0) {
          await tx.vehicleChangeLog.createMany({
            data: changes.map((change) => ({
              vehicleId: id,
              field: change.field,
              oldValue: change.oldValue,
              newValue: change.newValue,
            })),
          });
        }

        return this.withProfilePhotoUrl(updated);
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const target = Array.isArray(error?.meta?.target)
          ? String(error.meta.target[0] || '')
          : String(error?.meta?.target || '');

        if (/plate/i.test(target)) {
          throw new BadRequestException('Ja existe veiculo com placa informada.');
        }
        if (/chassis/i.test(target)) {
          throw new BadRequestException('Ja existe veiculo com chassi informado.');
        }
        if (/renavam/i.test(target)) {
          throw new BadRequestException('Ja existe veiculo com renavam informado.');
        }

        throw new BadRequestException(
          'Nao foi possivel salvar: placa, chassi ou renavam ja cadastrado.',
        );
      }
      throw error;
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.vehicle.delete({ where: { id } });
    return { message: 'Vehicle removido com sucesso' };
  }

  async uploadProfilePhoto(vehicleId: string, file: {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  }) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle nao encontrado');

    await this.prisma.vehicleProfilePhoto.upsert({
      where: { vehicleId },
      update: {
        filename: file.originalname || 'vehicle-profile-photo',
        mimeType: file.mimetype || 'application/octet-stream',
        size: file.size || 0,
        data: file.buffer,
      },
      create: {
        vehicleId,
        filename: file.originalname || 'vehicle-profile-photo',
        mimeType: file.mimetype || 'application/octet-stream',
        size: file.size || 0,
        data: file.buffer,
      },
    });

    return {
      vehicleId,
      profilePhotoUrl: `/vehicles/${vehicleId}/profile-photo`,
    };
  }

  async getProfilePhoto(vehicleId: string) {
    const photo = await this.prisma.vehicleProfilePhoto.findUnique({
      where: { vehicleId },
      select: { mimeType: true, filename: true, data: true },
    });
    if (!photo) throw new NotFoundException('Foto de perfil nao encontrada');
    return photo;
  }
}
