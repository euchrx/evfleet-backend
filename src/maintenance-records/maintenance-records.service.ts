import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMaintenanceRecordDto } from './dto/create-maintenance-record.dto';
import { UpdateMaintenanceRecordDto } from './dto/update-maintenance-record.dto';

@Injectable()
export class MaintenanceRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly PENDING_STATUSES = new Set(['OPEN', 'PENDING']);

  private readonly includeVehicle = {
    vehicle: {
      include: {
        branch: true,
        costCenter: true,
      },
    },
  } as const;

  async create(dto: CreateMaintenanceRecordDto) {
    await this.ensureVehicleExists(dto.vehicleId);

    return this.prisma.$transaction(async (tx) => {
      const created = await (tx as any).maintenanceRecord.create({
        data: {
          type: dto.type,
          description: dto.description,
          partsReplaced: dto.partsReplaced ?? [],
          workshop: dto.workshop ?? null,
          responsible: dto.responsible ?? null,
          cost: dto.cost,
          km: Math.round(dto.km),
          maintenanceDate: new Date(dto.maintenanceDate),
          status: dto.status,
          notes: dto.notes ?? null,
          vehicleId: dto.vehicleId,
        },
        include: this.includeVehicle,
      });

      await this.updateVehicleKm(created.vehicleId, created.km, tx);
      await this.syncVehicleStatusByMaintenance(created.vehicleId, tx);
      return created;
    });
  }

  async findAll() {
    const prisma = this.prisma as any;
    return prisma.maintenanceRecord.findMany({
      orderBy: { maintenanceDate: 'desc' },
      include: this.includeVehicle,
    });
  }

  async findOne(id: string) {
    const prisma = this.prisma as any;
    const record = await prisma.maintenanceRecord.findUnique({
      where: { id },
      include: this.includeVehicle,
    });

    if (!record) throw new NotFoundException('Manutencao nao encontrada');
    return record;
  }

  async update(id: string, dto: UpdateMaintenanceRecordDto) {
    const previous = await this.findOne(id);

    if (!dto || Object.keys(dto).length === 0) {
      throw new BadRequestException('Envie ao menos um campo para atualizar.');
    }

    if (dto.vehicleId) {
      await this.ensureVehicleExists(dto.vehicleId);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await (tx as any).maintenanceRecord.update({
        where: { id },
        data: {
          ...(dto.type !== undefined ? { type: dto.type } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.partsReplaced !== undefined
            ? { partsReplaced: dto.partsReplaced }
            : {}),
          ...(dto.workshop !== undefined ? { workshop: dto.workshop } : {}),
          ...(dto.responsible !== undefined ? { responsible: dto.responsible } : {}),
          ...(dto.cost !== undefined ? { cost: dto.cost } : {}),
          ...(dto.km !== undefined ? { km: Math.round(dto.km) } : {}),
          ...(dto.maintenanceDate !== undefined
            ? { maintenanceDate: new Date(dto.maintenanceDate) }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(dto.vehicleId !== undefined ? { vehicleId: dto.vehicleId } : {}),
        },
        include: this.includeVehicle,
      });

      await this.updateVehicleKm(updated.vehicleId, updated.km, tx);
      if (previous.vehicleId !== updated.vehicleId) {
        await this.recalculateVehicleKm(previous.vehicleId, tx);
      } else if (dto.km !== undefined && updated.km < previous.km) {
        await this.recalculateVehicleKm(updated.vehicleId, tx);
      }

      await this.syncVehicleStatusByMaintenance(updated.vehicleId, tx);
      if (previous.vehicleId !== updated.vehicleId) {
        await this.syncVehicleStatusByMaintenance(previous.vehicleId, tx);
      }

      return updated;
    });
  }

  async remove(id: string) {
    const record = await this.findOne(id);

    await this.prisma.$transaction(async (tx) => {
      await (tx as any).maintenanceRecord.delete({ where: { id } });
      await this.recalculateVehicleKm(record.vehicleId, tx);
      await this.syncVehicleStatusByMaintenance(record.vehicleId, tx);
    });

    return { message: 'Manutencao removida com sucesso' };
  }

  private async ensureVehicleExists(vehicleId: string) {
    const exists = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true },
    });

    if (!exists) throw new NotFoundException('Veiculo nao encontrado');
  }

  private async updateVehicleKm(
    vehicleId: string,
    km: number,
    client: any = this.prisma,
  ) {
    const current = await client.vehicle.findUnique({
      where: { id: vehicleId },
      select: { currentKm: true },
    });

    if (!current) return;
    if (km <= current.currentKm) return;

    await client.vehicle.update({
      where: { id: vehicleId },
      data: { currentKm: km },
    });
  }

  private async recalculateVehicleKm(
    vehicleId: string,
    client: any = this.prisma,
  ) {
    const [lastFuel, lastMaintenance] = await Promise.all([
      client.fuelRecord.findFirst({
        where: { vehicleId },
        orderBy: { km: 'desc' },
        select: { km: true },
      }),
      client.maintenanceRecord.findFirst({
        where: { vehicleId },
        orderBy: { km: 'desc' },
        select: { km: true },
      }),
    ]);

    const nextKm = Math.max(lastFuel?.km ?? 0, lastMaintenance?.km ?? 0);

    await client.vehicle.update({
      where: { id: vehicleId },
      data: { currentKm: nextKm },
    });
  }

  private normalizeMaintenanceStatus(value: string | null | undefined) {
    return String(value || '')
      .trim()
      .toUpperCase();
  }

  private async syncVehicleStatusByMaintenance(
    vehicleId: string,
    client: any = this.prisma,
  ) {
    const [vehicle, pendingMaintenance] = await Promise.all([
      client.vehicle.findUnique({
        where: { id: vehicleId },
        select: { id: true, status: true },
      }),
      client.maintenanceRecord.findFirst({
        where: {
          vehicleId,
          status: {
            in: [...this.PENDING_STATUSES],
          },
        },
        select: { id: true, status: true },
      }),
    ]);

    if (!vehicle) return;
    if (vehicle.status === 'SOLD') return;

    const hasPendingMaintenance = !!pendingMaintenance;

    const nextStatus = hasPendingMaintenance ? 'MAINTENANCE' : 'ACTIVE';
    if (vehicle.status === nextStatus) return;

    await client.vehicle.update({
      where: { id: vehicleId },
      data: { status: nextStatus },
    });
  }
}
