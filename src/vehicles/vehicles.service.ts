import {
  ConflictException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentType,
  SubscriptionStatus,
  VehicleImplementHistoryEventType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { SyncVehicleImplementsDto } from './dto/sync-vehicle-implements.dto';

type ChangeItem = {
  field: string;
  oldValue: string | null;
  newValue: string | null;
};

type SyncImplementsContext = {
  actorUserId?: string | null;
};

type ImplementHistoryEntryInput = {
  eventType: VehicleImplementHistoryEventType;
  vehicleId: string;
  implementId: string;
  actorUserId?: string | null;
  position?: number | null;
  oldPosition?: number | null;
  newPosition?: number | null;
};

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) { }

  private static readonly AUTO_VEHICLE_DOCUMENT_DEFINITIONS: Array<{
    type: DocumentType;
    name: string;
  }> = [
      { type: DocumentType.CRLV, name: 'CRLV' },
      { type: DocumentType.CIV, name: 'CIV' },
      { type: DocumentType.CIPP, name: 'CIPP' },
    ];

  private async ensureDefaultVehicleDocuments(
    tx: any,
    input: { vehicleId: string; companyId: string },
  ) {
    const existingDocuments = await tx.vehicleDocument.findMany({
      where: {
        ownerType: 'VEHICLE',
        vehicleId: input.vehicleId,
        type: {
          in: VehiclesService.AUTO_VEHICLE_DOCUMENT_DEFINITIONS.map(
            (item) => item.type,
          ),
        },
      },
      select: {
        type: true,
      },
    });

    const existingTypes = new Set<string>(
      existingDocuments.map((item: { type: string }) => item.type),
    );

    const documentsToCreate =
      VehiclesService.AUTO_VEHICLE_DOCUMENT_DEFINITIONS.filter(
        (item) => !existingTypes.has(item.type),
      );

    if (documentsToCreate.length === 0) {
      return;
    }

    await tx.vehicleDocument.createMany({
      data: documentsToCreate.map((item) => ({
        type: item.type,
        ownerType: 'VEHICLE',
        name: item.name,
        status: 'VALID',
        companyId: input.companyId,
        vehicleId: input.vehicleId,
      })),
    });
  }

  private async enforceVehicleLimitForCompany(companyId: string) {
    const normalizedCompanyId = String(companyId || '').trim();
    if (!normalizedCompanyId) return;

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        companyId: normalizedCompanyId,
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        plan: {
          select: {
            id: true,
            name: true,
            vehicleLimit: true,
          },
        },
      },
    });

    const vehicleLimit = Number(subscription?.plan?.vehicleLimit || 0);
    if (!Number.isFinite(vehicleLimit) || vehicleLimit <= 0) return;

    const currentVehicles = await this.prisma.vehicle.count({
      where: { companyId: normalizedCompanyId },
    });

    if (currentVehicles >= vehicleLimit) {
      throw new ConflictException(
        `Limite máximo atingido para cadastro de veículos. Plano permite até ${vehicleLimit} veículo(s).`,
      );
    }
  }

  private resolveCompanyIdFromContext(context?: {
    role?: string;
    userCompanyId?: string;
    scopeCompanyId?: string;
  }) {
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

    return companyId;
  }

  private async validateOptionalBranchId(
    inputBranchId: string | undefined,
    companyId: string,
  ) {
    const branchId = String(inputBranchId || '').trim();
    if (!branchId) return null;

    const branchExists = await this.prisma.branch.findFirst({
      where: { id: branchId, companyId },
      select: { id: true },
    });

    if (!branchExists) {
      throw new BadRequestException(
        'A filial informada nao pertence a empresa selecionada.',
      );
    }

    return branchExists.id;
  }

  private async resolveBranchIdForCreate(
    inputBranchId: string | undefined,
    context?: { role?: string; userCompanyId?: string; scopeCompanyId?: string },
  ) {
    const companyId = this.resolveCompanyIdFromContext(context);
    return this.validateOptionalBranchId(inputBranchId, companyId);
  }

  private withProfilePhotoUrl<T extends { id: string; profilePhoto?: { id: string } | null }>(
    vehicle: T,
  ) {
    return {
      ...vehicle,
      profilePhotoUrl: vehicle.profilePhoto ? `/vehicles/${vehicle.id}/profile-photo` : null,
    };
  }

  private mapImplementLinks(links: Array<any> | null | undefined) {
    return (links || []).map((link) => ({
      id: link.id,
      position: link.position,
      implementId: link.implementId,
      implement: this.withProfilePhotoUrl(link.implement as any),
    }));
  }

  private mapVehicleListItem(vehicle: any) {
    return {
      ...this.withProfilePhotoUrl(vehicle),
      implements: this.mapImplementLinks(vehicle.implementLinks),
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
      select: { id: true, plate: true, chassis: true, renavam: true, fipeValue: true },
      take: 5,
    });

    const duplicatedFields: string[] = [];

    if (
      conflicts.some((item) => (item.plate || '').toUpperCase() === normalizedPlate)
    ) {
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
      fipeValue: 'Valor FIPE',
      vehicleType: 'Tipo de peso',
      category: 'Tipo de veiculo',
      axleCount: 'Quatidade de eixos',
      axleConfiguration: 'Configuração dos eixos traseiros',
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

  private validateVehicleBusinessRules(data: {
    category: 'CAR' | 'TRUCK' | 'UTILITY' | 'IMPLEMENT';
    vehicleType: 'LIGHT' | 'HEAVY';
    axleCount?: number | null;
    axleConfiguration?: 'SINGLE' | 'DUAL' | null;
    fuelType?: string | null;
    tankCapacity?: number | null;
  }) {
    const axleCount = Number(data.axleCount || 0);

    if (data.category === 'CAR') {
      if (data.vehicleType !== 'LIGHT') {
        throw new BadRequestException('Carro deve ser do tipo LIGHT.');
      }
      if (axleCount !== 2) {
        throw new BadRequestException('Carro deve ter 2 eixos.');
      }
    }

    if (data.category === 'UTILITY') {
      if (data.vehicleType !== 'LIGHT') {
        throw new BadRequestException('Utilitário deve ser do tipo LIGHT.');
      }
      if (axleCount !== 2) {
        throw new BadRequestException('Utilitário deve ter 2 eixos.');
      }
    }

    if (data.category === 'TRUCK') {
      if (data.vehicleType !== 'HEAVY') {
        throw new BadRequestException('Caminhão deve ser do tipo HEAVY.');
      }
      if (![2, 3].includes(axleCount)) {
        throw new BadRequestException('Caminhão deve ter 2 ou 3 eixos.');
      }
      if (!data.axleConfiguration) {
        throw new BadRequestException(
          'Informe a configuração dos eixos traseiros do caminhão.',
        );
      }
    }

    if (data.category === 'IMPLEMENT') {
      if (data.vehicleType !== 'HEAVY') {
        throw new BadRequestException('Implemento deve ser do tipo HEAVY.');
      }
      if (![2, 3, 4].includes(axleCount)) {
        throw new BadRequestException('Implemento deve ter 2, 3 ou 4 eixos.');
      }
      if (data.axleConfiguration) {
        throw new BadRequestException(
          'Implemento não deve possuir configuração de eixo traseiro.',
        );
      }
      if (data.fuelType !== undefined && data.fuelType !== null) {
        throw new BadRequestException('Implemento não utiliza combustível.');
      }
      if (data.tankCapacity !== undefined && data.tankCapacity !== null) {
        throw new BadRequestException('Implemento não utiliza capacidade de tanque.');
      }
    }
  }

  private async validateImplementLinks(vehicleId: string, implementIds: string[]) {
    const normalizedIds = Array.from(
      new Set(
        (implementIds || [])
          .map((id) => String(id || '').trim())
          .filter(Boolean),
      ),
    );

    if (normalizedIds.length > 2) {
      throw new BadRequestException(
        'É permitido vincular no máximo 2 implementos ao veículo.',
      );
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: {
        id: true,
        category: true,
        companyId: true,
      },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle nao encontrado');
    }

    if (vehicle.category === 'IMPLEMENT') {
      throw new BadRequestException(
        'Implemento não pode ser veículo principal da composição.',
      );
    }

    if (normalizedIds.length === 0) {
      return {
        vehicle,
        implementIds: normalizedIds,
        implements: [],
      };
    }

    const implementsFound = await this.prisma.vehicle.findMany({
      where: {
        id: { in: normalizedIds },
      },
      select: {
        id: true,
        plate: true,
        category: true,
        companyId: true,
        axleCount: true,
        axleConfiguration: true,
      },
    });

    if (implementsFound.length !== normalizedIds.length) {
      throw new NotFoundException('Um ou mais implementos não foram encontrados.');
    }

    for (const implement of implementsFound) {
      if (implement.companyId !== vehicle.companyId) {
        throw new BadRequestException(
          'O implemento informado não pertence à mesma empresa do veículo.',
        );
      }

      if (implement.category !== 'IMPLEMENT') {
        throw new BadRequestException(
          `O veículo ${implement.plate} não é um implemento válido.`,
        );
      }

      if (implement.id === vehicle.id) {
        throw new BadRequestException(
          'O veículo principal não pode ser vinculado como implemento dele mesmo.',
        );
      }
    }

    const alreadyLinked = await this.prisma.vehicleImplementLink.findMany({
      where: {
        implementId: { in: normalizedIds },
        vehicleId: { not: vehicleId },
      },
      select: {
        implementId: true,
        vehicleId: true,
        vehicle: {
          select: {
            id: true,
            plate: true,
          },
        },
      },
    });

    if (alreadyLinked.length > 0) {
      const firstConflict = alreadyLinked[0];
      throw new ConflictException(
        `O implemento já está vinculado ao veículo ${firstConflict.vehicle?.plate || firstConflict.vehicleId}.`,
      );
    }

    return {
      vehicle,
      implementIds: normalizedIds,
      implements: implementsFound,
    };
  }

  private buildImplementHistoryEntries(params: {
    vehicleId: string;
    previousLinks: Array<{
      implementId: string;
      position: number;
      implement: { id: string; plate: string };
    }>;
    nextImplementIds: string[];
    actorUserId?: string | null;
  }): ImplementHistoryEntryInput[] {
    const previousByImplementId = new Map(
      params.previousLinks.map((link) => [link.implementId, link]),
    );
    const nextPositionByImplementId = new Map<string, number>();

    params.nextImplementIds.forEach((implementId, index) => {
      nextPositionByImplementId.set(implementId, index + 1);
    });

    const historyEntries: ImplementHistoryEntryInput[] = [];

    for (const previousLink of params.previousLinks) {
      const nextPosition = nextPositionByImplementId.get(previousLink.implementId);

      if (!nextPosition) {
        historyEntries.push({
          eventType: VehicleImplementHistoryEventType.UNLINKED,
          vehicleId: params.vehicleId,
          implementId: previousLink.implementId,
          actorUserId: params.actorUserId ?? null,
          position: previousLink.position,
          oldPosition: previousLink.position,
          newPosition: null,
        });
        continue;
      }

      if (nextPosition !== previousLink.position) {
        historyEntries.push({
          eventType: VehicleImplementHistoryEventType.POSITION_CHANGED,
          vehicleId: params.vehicleId,
          implementId: previousLink.implementId,
          actorUserId: params.actorUserId ?? null,
          position: nextPosition,
          oldPosition: previousLink.position,
          newPosition: nextPosition,
        });
      }
    }

    for (const implementId of params.nextImplementIds) {
      if (previousByImplementId.has(implementId)) {
        continue;
      }

      const nextPosition = nextPositionByImplementId.get(implementId) ?? null;

      historyEntries.push({
        eventType: VehicleImplementHistoryEventType.LINKED,
        vehicleId: params.vehicleId,
        implementId,
        actorUserId: params.actorUserId ?? null,
        position: nextPosition,
        oldPosition: null,
        newPosition: nextPosition,
      });
    }

    return historyEntries;
  }

  private mapImplementHistoryEvent(entry: {
    changedAt: Date;
    eventType: VehicleImplementHistoryEventType;
    position: number | null;
    oldPosition: number | null;
    newPosition: number | null;
    implement: {
      plate: string;
      brand: string;
      model: string;
    };
    actorUser?: {
      id: string;
      name: string;
    } | null;
  }) {
    const implementLabel = `${entry.implement.plate} (${entry.implement.brand} ${entry.implement.model})`;
    const actorSuffix = entry.actorUser?.name
      ? ` | por ${entry.actorUser.name}`
      : '';

    if (entry.eventType === VehicleImplementHistoryEventType.LINKED) {
      return {
        date: entry.changedAt,
        type: 'IMPLEMENT_LINKED',
        title: 'Implemento vinculado',
        description: `${implementLabel} | posição ${entry.newPosition ?? entry.position ?? '-'}${actorSuffix}`,
      };
    }

    if (entry.eventType === VehicleImplementHistoryEventType.UNLINKED) {
      return {
        date: entry.changedAt,
        type: 'IMPLEMENT_UNLINKED',
        title: 'Implemento desvinculado',
        description: `${implementLabel} | posição ${entry.oldPosition ?? entry.position ?? '-'}${actorSuffix}`,
      };
    }

    return {
      date: entry.changedAt,
      type: 'IMPLEMENT_POSITION_CHANGED',
      title: 'Posição do implemento alterada',
      description: `${implementLabel} | ${entry.oldPosition ?? '-'} > ${entry.newPosition ?? '-'}${actorSuffix}`,
    };
  }

  async create(
    dto: CreateVehicleDto,
    context?: { role?: string; userCompanyId?: string; scopeCompanyId?: string },
  ) {
    const companyId = this.resolveCompanyIdFromContext(context);
    const resolvedBranchId = await this.resolveBranchIdForCreate(
      dto.branchId,
      context,
    );

    await this.enforceVehicleLimitForCompany(companyId);

    const plate = this.normalizeText(dto.plate)?.toUpperCase() || '';
    const chassis = this.normalizeText(dto.chassis)?.toUpperCase() || null;
    const renavam = this.normalizeText(dto.renavam) || null;

    await this.ensureUniqueVehicleFields({ plate, chassis, renavam });

    try {
      this.validateVehicleBusinessRules({
        category: dto.category,
        vehicleType: dto.vehicleType,
        axleCount: dto.axleCount,
        axleConfiguration: dto.axleConfiguration ?? null,
        fuelType: dto.fuelType ?? null,
        tankCapacity: dto.tankCapacity ?? null,
      });

      const vehicle = await this.prisma.$transaction(async (tx) => {
        const createdVehicle = await tx.vehicle.create({
          data: {
            plate,
            model: dto.model,
            brand: dto.brand,
            year: dto.year,
            fipeValue: dto.fipeValue ?? null,

            vehicleType: dto.vehicleType,
            category: dto.category,
            axleCount: dto.axleCount,
            axleConfiguration:
              dto.category === 'TRUCK' ? dto.axleConfiguration ?? null : null,

            chassis,
            renavam,
            acquisitionDate: dto.acquisitionDate
              ? new Date(dto.acquisitionDate)
              : null,

            fuelType: dto.category === 'IMPLEMENT' ? null : dto.fuelType ?? null,
            tankCapacity:
              dto.category === 'IMPLEMENT' ? null : dto.tankCapacity ?? null,

            status: dto.status ?? 'ACTIVE',
            photoUrls: dto.photoUrls ?? [],
            documentUrls: dto.documentUrls ?? [],

            company: { connect: { id: companyId } },
            ...(resolvedBranchId
              ? { branch: { connect: { id: resolvedBranchId } } }
              : {}),
          },
          include: {
            branch: true,
            costCenter: true,
            profilePhoto: { select: { id: true } },
          },
        });

        await this.ensureDefaultVehicleDocuments(tx, {
          vehicleId: createdVehicle.id,
          companyId,
        });

        return createdVehicle;
      });

      return this.withProfilePhotoUrl(vehicle);
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const target = Array.isArray(error?.meta?.target)
          ? String(error.meta.target[0] || '')
          : String(error?.meta?.target || '');

        if (/plate/i.test(target)) {
          throw new BadRequestException(
            'Ja existe veiculo com placa informada.',
          );
        }

        if (/chassis/i.test(target)) {
          throw new BadRequestException(
            'Ja existe veiculo com chassi informado.',
          );
        }

        if (/renavam/i.test(target)) {
          throw new BadRequestException(
            'Ja existe veiculo com renavam informado.',
          );
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
        include: {
          branch: true,
          costCenter: true,
          profilePhoto: { select: { id: true } },
          implementLinks: {
            orderBy: { position: 'asc' },
            include: {
              implement: {
                include: {
                  branch: true,
                  costCenter: true,
                  profilePhoto: { select: { id: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      items: items.map((item) => this.mapVehicleListItem(item)),
    };
  }

  async findOne(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: {
        branch: true,
        costCenter: true,
        profilePhoto: { select: { id: true } },
        implementLinks: {
          orderBy: { position: 'asc' },
          include: {
            implement: {
              include: {
                profilePhoto: { select: { id: true } },
              },
            },
          },
        },
      },
    });

    if (!vehicle) throw new NotFoundException('Vehicle nao encontrado');

    return {
      ...this.withProfilePhotoUrl(vehicle),
      implements: this.mapImplementLinks(vehicle.implementLinks),
    };
  }

  async getHistory(id: string, page = 1, limit = 10) {
    const [vehicle, implementHistory] = await Promise.all([
      this.prisma.vehicle.findUnique({
        where: { id },
        include: {
          branch: true,
          maintenanceRecords: true,
          fuelRecords: true,
          debts: true,
          maintenancePlans: true,
          changeLogs: true,
        },
      }),
      this.prisma.vehicleImplementHistory.findMany({
        where: { vehicleId: id },
        orderBy: { changedAt: 'desc' },
        include: {
          implement: {
            select: {
              id: true,
              plate: true,
              brand: true,
              model: true,
            },
          },
          actorUser: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

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
      ...implementHistory.map((entry) => this.mapImplementHistoryEvent(entry)),
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

  async findLinkedImplements(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: {
        id: true,
        plate: true,
        category: true,
      },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle nao encontrado');
    }

    const links = await this.prisma.vehicleImplementLink.findMany({
      where: { vehicleId },
      orderBy: { position: 'asc' },
      include: {
        implement: {
          include: {
            branch: true,
            costCenter: true,
            profilePhoto: { select: { id: true } },
          },
        },
      },
    });

    return {
      vehicle,
      implements: this.mapImplementLinks(links),
    };
  }

  async syncImplements(
    vehicleId: string,
    dto: SyncVehicleImplementsDto,
    context?: SyncImplementsContext,
  ) {
    const implementIds = dto.implementIds ?? [];

    const validation = await this.validateImplementLinks(vehicleId, implementIds);

    await this.prisma.$transaction(async (tx) => {
      const previousLinks = await tx.vehicleImplementLink.findMany({
        where: { vehicleId },
        orderBy: { position: 'asc' },
        include: {
          implement: {
            select: {
              id: true,
              plate: true,
            },
          },
        },
      });

      const historyEntries = this.buildImplementHistoryEntries({
        vehicleId,
        previousLinks,
        nextImplementIds: validation.implementIds,
        actorUserId: context?.actorUserId ?? null,
      });

      await tx.vehicleImplementLink.deleteMany({
        where: { vehicleId },
      });

      if (validation.implementIds.length > 0) {
        await tx.vehicleImplementLink.createMany({
          data: validation.implementIds.map((implementId, index) => ({
            vehicleId,
            implementId,
            position: index + 1,
          })),
        });
      }

      if (historyEntries.length > 0) {
        await tx.vehicleImplementHistory.createMany({
          data: historyEntries.map((entry) => ({
            eventType: entry.eventType,
            vehicleId: entry.vehicleId,
            implementId: entry.implementId,
            actorUserId: entry.actorUserId ?? null,
            position: entry.position ?? null,
            oldPosition: entry.oldPosition ?? null,
            newPosition: entry.newPosition ?? null,
          })),
        });
      }
    });

    return this.findLinkedImplements(vehicleId);
  }

  async update(id: string, dto: UpdateVehicleDto) {
    const current = await this.prisma.vehicle.findUnique({
      where: { id },
    });

    if (!current) throw new NotFoundException('Vehicle nao encontrado');

    const nextCategory = dto.category ?? current.category;
    const nextVehicleType = dto.vehicleType ?? current.vehicleType;
    const nextAxleCount =
      dto.axleCount !== undefined ? dto.axleCount : (current as any).axleCount ?? null;
    const nextAxleConfiguration =
      dto.axleConfiguration !== undefined
        ? dto.axleConfiguration
        : (current as any).axleConfiguration ?? null;
    const nextFuelType =
      dto.fuelType !== undefined ? dto.fuelType : current.fuelType ?? null;
    const nextTankCapacity =
      dto.tankCapacity !== undefined ? dto.tankCapacity : current.tankCapacity ?? null;

    this.validateVehicleBusinessRules({
      category: nextCategory,
      vehicleType: nextVehicleType,
      axleCount: nextAxleCount,
      axleConfiguration: nextAxleConfiguration,
      fuelType: nextFuelType,
      tankCapacity: nextTankCapacity,
    });

    if (!dto || Object.keys(dto).length === 0) {
      throw new BadRequestException('Envie ao menos um campo para atualizar.');
    }

    if (dto.branchId !== undefined && dto.branchId !== null) {
      const exists = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, companyId: current.companyId },
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
        const nextCategoryForPersist = dto.category ?? current.category;
        const shouldKeepTruckConfiguration = nextCategoryForPersist === 'TRUCK';
        const shouldNullFuelAndTank = nextCategoryForPersist === 'IMPLEMENT';

        const updated = await tx.vehicle.update({
          where: { id },
          data: {
            ...scalar,
            ...(dto.fipeValue !== undefined
              ? { fipeValue: dto.fipeValue ?? null }
              : {}),
            ...(dto.plate !== undefined ? { plate: nextPlate } : {}),
            ...(dto.chassis !== undefined ? { chassis: nextChassis } : {}),
            ...(dto.renavam !== undefined ? { renavam: nextRenavam } : {}),
            ...(dto.axleCount !== undefined ? { axleCount: dto.axleCount } : {}),
            ...(dto.axleConfiguration !== undefined || dto.category !== undefined
              ? {
                axleConfiguration: shouldKeepTruckConfiguration
                  ? dto.axleConfiguration ?? current.axleConfiguration ?? null
                  : null,
              }
              : {}),
            ...(dto.fuelType !== undefined || dto.category !== undefined
              ? { fuelType: shouldNullFuelAndTank ? null : dto.fuelType ?? current.fuelType ?? null }
              : {}),
            ...(dto.tankCapacity !== undefined || dto.category !== undefined
              ? {
                tankCapacity: shouldNullFuelAndTank
                  ? null
                  : dto.tankCapacity ?? current.tankCapacity ?? null,
              }
              : {}),
            ...(dto.acquisitionDate !== undefined
              ? { acquisitionDate: acquisitionDate ? new Date(acquisitionDate) : null }
              : {}),
            ...(branchId !== undefined
              ? branchId
                ? { branch: { connect: { id: branchId } } }
                : { branch: { disconnect: true } }
              : {}),
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
    await this.prisma.vehicleImplementLink.deleteMany({
      where: {
        OR: [{ vehicleId: id }, { implementId: id }],
      },
    });
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