import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly includeRelations = {
    vehicle: {
      include: {
        branch: true,
      },
    },
    driver: true,
  } as const;

  async create(dto: CreateTripDto) {
    await this.ensureVehicleExists(dto.vehicleId);
    if (dto.driverId) await this.ensureDriverExists(dto.driverId);

    const created = await (this.prisma as any).trip.create({
      data: {
        origin: dto.origin,
        destination: dto.destination,
        ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
        departureKm: Math.round(dto.departureKm),
        ...(dto.returnKm !== undefined ? { returnKm: Math.round(dto.returnKm) } : {}),
        departureAt: new Date(dto.departureAt),
        ...(dto.returnAt !== undefined ? { returnAt: new Date(dto.returnAt) } : {}),
        status: dto.status ?? 'OPEN',
        vehicleId: dto.vehicleId,
        ...(dto.driverId !== undefined ? { driverId: dto.driverId } : {}),
      },
      include: this.includeRelations,
    });

    await this.updateVehicleKm(created.vehicleId, created.returnKm ?? created.departureKm);
    return created;
  }

  async findAll() {
    return (this.prisma as any).trip.findMany({
      orderBy: { departureAt: 'desc' },
      include: this.includeRelations,
    });
  }

  async findOne(id: string) {
    const trip = await (this.prisma as any).trip.findUnique({
      where: { id },
      include: this.includeRelations,
    });
    if (!trip) throw new NotFoundException('Viagem nao encontrada');
    return trip;
  }

  async update(id: string, dto: UpdateTripDto) {
    const previous = await this.findOne(id);
    if (!dto || Object.keys(dto).length === 0) {
      throw new BadRequestException('Envie ao menos um campo para atualizar.');
    }

    if (dto.vehicleId) await this.ensureVehicleExists(dto.vehicleId);
    if (dto.driverId) await this.ensureDriverExists(dto.driverId);

    const updated = await (this.prisma as any).trip.update({
      where: { id },
      data: {
        ...(dto.origin !== undefined ? { origin: dto.origin } : {}),
        ...(dto.destination !== undefined ? { destination: dto.destination } : {}),
        ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
        ...(dto.departureKm !== undefined ? { departureKm: Math.round(dto.departureKm) } : {}),
        ...(dto.returnKm !== undefined ? { returnKm: Math.round(dto.returnKm) } : {}),
        ...(dto.departureAt !== undefined ? { departureAt: new Date(dto.departureAt) } : {}),
        ...(dto.returnAt !== undefined ? { returnAt: new Date(dto.returnAt) } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.vehicleId !== undefined ? { vehicleId: dto.vehicleId } : {}),
        ...(dto.driverId !== undefined ? { driverId: dto.driverId } : {}),
      },
      include: this.includeRelations,
    });

    await this.updateVehicleKm(updated.vehicleId, updated.returnKm ?? updated.departureKm);
    if (previous.vehicleId !== updated.vehicleId) {
      await this.recalculateVehicleKm(previous.vehicleId);
    }

    return updated;
  }

  async remove(id: string) {
    const trip = await this.findOne(id);
    await (this.prisma as any).trip.delete({ where: { id } });
    await this.recalculateVehicleKm(trip.vehicleId);
    return { message: 'Viagem removida com sucesso' };
  }

  private async ensureVehicleExists(vehicleId: string) {
    const exists = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Veiculo nao encontrado');
  }

  private async ensureDriverExists(driverId: string) {
    const exists = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Motorista nao encontrado');
  }

  private async updateVehicleKm(vehicleId: string, km: number) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { currentKm: true },
    });
    if (!vehicle) return;
    if (km <= vehicle.currentKm) return;

    await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { currentKm: km },
    });
  }

  private async recalculateVehicleKm(vehicleId: string) {
    const [lastFuel, lastMaintenance, lastTrip] = await Promise.all([
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
      (this.prisma as any).trip.findFirst({
        where: { vehicleId },
        orderBy: { returnKm: 'desc' },
        select: { departureKm: true, returnKm: true },
      }),
    ]);

    const tripKm = Math.max(lastTrip?.returnKm ?? 0, lastTrip?.departureKm ?? 0);
    const nextKm = Math.max(lastFuel?.km ?? 0, lastMaintenance?.km ?? 0, tripKm);

    await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { currentKm: nextKm },
    });
  }
}
