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

  private readonly includeVehicle = {
    vehicle: {
      include: {
        branch: true,
        costCenter: true,
      },
    },
  } as const;

  async create(dto: CreateMaintenanceRecordDto) {
    const prisma = this.prisma as any;
    await this.ensureVehicleExists(dto.vehicleId);

    const created = await prisma.maintenanceRecord.create({
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

    await this.updateVehicleKm(created.vehicleId, created.km);
    return created;
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
    const prisma = this.prisma as any;
    const previous = await this.findOne(id);

    if (!dto || Object.keys(dto).length === 0) {
      throw new BadRequestException('Envie ao menos um campo para atualizar.');
    }

    if (dto.vehicleId) {
      await this.ensureVehicleExists(dto.vehicleId);
    }

    const updated = await prisma.maintenanceRecord.update({
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

    await this.updateVehicleKm(updated.vehicleId, updated.km);
    if (previous.vehicleId !== updated.vehicleId) {
      await this.recalculateVehicleKm(previous.vehicleId);
    } else if (dto.km !== undefined && updated.km < previous.km) {
      await this.recalculateVehicleKm(updated.vehicleId);
    }

    return updated;
  }

  async remove(id: string) {
    const prisma = this.prisma as any;
    const record = await this.findOne(id);
    await prisma.maintenanceRecord.delete({ where: { id } });
    await this.recalculateVehicleKm(record.vehicleId);
    return { message: 'Manutencao removida com sucesso' };
  }

  private async ensureVehicleExists(vehicleId: string) {
    const exists = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true },
    });

    if (!exists) throw new NotFoundException('Veiculo nao encontrado');
  }

  private async updateVehicleKm(vehicleId: string, km: number) {
    const current = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { currentKm: true },
    });

    if (!current) return;
    if (km <= current.currentKm) return;

    await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { currentKm: km },
    });
  }

  private async recalculateVehicleKm(vehicleId: string) {
    const [lastFuel, lastMaintenance] = await Promise.all([
      (this.prisma as any).fuelRecord.findFirst({
        where: { vehicleId },
        orderBy: { km: 'desc' },
        select: { km: true },
      }),
      (this.prisma as any).maintenanceRecord.findFirst({
        where: { vehicleId },
        orderBy: { km: 'desc' },
        select: { km: true },
      }),
    ]);

    const nextKm = Math.max(lastFuel?.km ?? 0, lastMaintenance?.km ?? 0);

    await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { currentKm: nextKm },
    });
  }
}
