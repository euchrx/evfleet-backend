import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTireDto } from './dto/create-tire.dto';
import { UpdateTireDto } from './dto/update-tire.dto';
import { CreateTireReadingDto } from './dto/create-tire-reading.dto';

@Injectable()
export class TiresService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly includeVehicle = {
    vehicle: {
      include: {
        branch: true,
      },
    },
  } as const;

  async create(dto: CreateTireDto) {
    if (dto.vehicleId) await this.ensureVehicleExists(dto.vehicleId);
    try {
      return await (this.prisma as any).tire.create({
        data: {
          serialNumber: dto.serialNumber.trim().toUpperCase(),
          brand: dto.brand.trim(),
          model: dto.model.trim(),
          size: dto.size.trim(),
          ...(dto.rim !== undefined
            ? { rim: new Prisma.Decimal(dto.rim) }
            : {}),
          ...(dto.purchaseDate !== undefined ? { purchaseDate: new Date(dto.purchaseDate) } : {}),
          ...(dto.purchaseCost !== undefined ? { purchaseCost: dto.purchaseCost } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.axlePosition !== undefined ? { axlePosition: dto.axlePosition } : {}),
          ...(dto.wheelPosition !== undefined ? { wheelPosition: dto.wheelPosition } : {}),
          ...(dto.currentKm !== undefined ? { currentKm: Math.round(dto.currentKm) } : {}),
          ...(dto.currentTreadDepthMm !== undefined ? { currentTreadDepthMm: dto.currentTreadDepthMm } : {}),
          ...(dto.currentPressurePsi !== undefined ? { currentPressurePsi: dto.currentPressurePsi } : {}),
          ...(dto.targetPressurePsi !== undefined ? { targetPressurePsi: dto.targetPressurePsi } : {}),
          ...(dto.minTreadDepthMm !== undefined ? { minTreadDepthMm: dto.minTreadDepthMm } : {}),
          ...(dto.installedAt !== undefined ? { installedAt: new Date(dto.installedAt) } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(dto.vehicleId !== undefined ? { vehicleId: dto.vehicleId } : {}),
        },
        include: this.includeVehicle,
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findAll() {
    return (this.prisma as any).tire.findMany({
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      include: {
        ...this.includeVehicle,
        readings: {
          orderBy: { readingDate: 'desc' },
          take: 1,
        },
      },
    });
  }

  async findOne(id: string) {
    const tire = await (this.prisma as any).tire.findUnique({
      where: { id },
      include: this.includeVehicle,
    });
    if (!tire) throw new NotFoundException('Pneu nao encontrado');
    return tire;
  }

  async update(id: string, dto: UpdateTireDto) {
    await this.findOne(id);
    if (!dto || Object.keys(dto).length === 0) {
      throw new BadRequestException('Envie ao menos um campo para atualizar.');
    }
    if (dto.vehicleId) await this.ensureVehicleExists(dto.vehicleId);

    return (this.prisma as any).tire.update({
      where: { id },
      data: {
        ...(dto.serialNumber !== undefined ? { serialNumber: dto.serialNumber.trim().toUpperCase() } : {}),
        ...(dto.brand !== undefined ? { brand: dto.brand.trim() } : {}),
        ...(dto.model !== undefined ? { model: dto.model.trim() } : {}),
        ...(dto.size !== undefined ? { size: dto.size.trim() } : {}),
        ...(dto.rim !== undefined
          ? { rim: new Prisma.Decimal(dto.rim) }
          : {}),
        ...(dto.purchaseDate !== undefined ? { purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null } : {}),
        ...(dto.purchaseCost !== undefined ? { purchaseCost: dto.purchaseCost } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.axlePosition !== undefined ? { axlePosition: dto.axlePosition } : {}),
        ...(dto.wheelPosition !== undefined ? { wheelPosition: dto.wheelPosition } : {}),
        ...(dto.currentKm !== undefined ? { currentKm: Math.round(dto.currentKm) } : {}),
        ...(dto.currentTreadDepthMm !== undefined ? { currentTreadDepthMm: dto.currentTreadDepthMm } : {}),
        ...(dto.currentPressurePsi !== undefined ? { currentPressurePsi: dto.currentPressurePsi } : {}),
        ...(dto.targetPressurePsi !== undefined ? { targetPressurePsi: dto.targetPressurePsi } : {}),
        ...(dto.minTreadDepthMm !== undefined ? { minTreadDepthMm: dto.minTreadDepthMm } : {}),
        ...(dto.installedAt !== undefined ? { installedAt: dto.installedAt ? new Date(dto.installedAt) : null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.vehicleId !== undefined ? { vehicleId: dto.vehicleId } : {}),
      },
      include: this.includeVehicle,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await (this.prisma as any).tire.delete({ where: { id } });
    return { message: 'Pneu removido com sucesso' };
  }

  async createReading(tireId: string, dto: CreateTireReadingDto) {
    const tire = await this.findOne(tireId);
    if (dto.vehicleId) await this.ensureVehicleExists(dto.vehicleId);

    const reading = await (this.prisma as any).tireReading.create({
      data: {
        tireId,
        readingDate: new Date(dto.readingDate),
        km: Math.round(dto.km),
        treadDepthMm: dto.treadDepthMm,
        pressurePsi: dto.pressurePsi,
        ...(dto.condition !== undefined ? { condition: dto.condition } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        vehicleId: dto.vehicleId ?? tire.vehicleId ?? null,
      },
    });

    await (this.prisma as any).tire.update({
      where: { id: tireId },
      data: {
        currentKm: reading.km,
        currentTreadDepthMm: reading.treadDepthMm,
        currentPressurePsi: reading.pressurePsi,
        ...(reading.vehicleId ? { vehicleId: reading.vehicleId } : {}),
      },
    });

    return reading;
  }

  async getReadings(tireId: string) {
    await this.findOne(tireId);
    return (this.prisma as any).tireReading.findMany({
      where: { tireId },
      orderBy: { readingDate: 'desc' },
      include: {
        vehicle: {
          include: { branch: true },
        },
      },
    });
  }

  async getAlertsSummary() {
    const tires = await (this.prisma as any).tire.findMany({
      where: {
        status: {
          in: ['INSTALLED', 'MAINTENANCE', 'RETREADED'],
        },
      },
      include: this.includeVehicle,
    });

    const alerts = tires.flatMap((tire: any) => {
      const items: Array<{ type: string; severity: string; message: string }> = [];

      if (
        typeof tire.currentTreadDepthMm === 'number' &&
        tire.currentTreadDepthMm <= (tire.minTreadDepthMm ?? 3)
      ) {
        items.push({
          type: 'TREAD',
          severity: 'HIGH',
          message: `Sulco abaixo do limite (${tire.currentTreadDepthMm} mm).`,
        });
      }

      if (
        typeof tire.currentPressurePsi === 'number' &&
        typeof tire.targetPressurePsi === 'number'
      ) {
        const diff = Math.abs(tire.currentPressurePsi - tire.targetPressurePsi);
        if (diff >= 8) {
          items.push({
            type: 'PRESSURE',
            severity: 'MEDIUM',
            message: `Pressao divergente da meta (${tire.currentPressurePsi} PSI / meta ${tire.targetPressurePsi} PSI).`,
          });
        }
      }

      return items.map((item) => ({
        tireId: tire.id,
        serialNumber: tire.serialNumber,
        brand: tire.brand,
        model: tire.model,
        size: tire.size,
        vehicle: tire.vehicle,
        ...item,
      }));
    });

    const summary = {
      total: alerts.length,
      high: alerts.filter((item) => item.severity === 'HIGH').length,
      medium: alerts.filter((item) => item.severity === 'MEDIUM').length,
      low: alerts.filter((item) => item.severity === 'LOW').length,
    };

    return { summary, alerts };
  }

  private async ensureVehicleExists(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) {
      throw new BadRequestException('Veiculo informado nao encontrado');
    }
    return vehicle;
  }

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new BadRequestException('Ja existe um pneu com esse numero de serie.');
    }

    throw new InternalServerErrorException('Nao foi possivel salvar o pneu.');
  }
}
