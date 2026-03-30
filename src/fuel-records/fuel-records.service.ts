import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFuelRecordDto } from './dto/create-fuel-record.dto';
import { UpdateFuelRecordDto } from './dto/update-fuel-record.dto';

@Injectable()
export class FuelRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly includeVehicle = {
    vehicle: {
      include: {
        branch: true,
        costCenter: true,
      },
    },
    driver: true,
  } as const;

  private normalizeInvoiceNumber(value?: string | null) {
    const normalized = String(value || '').trim().toUpperCase();
    return normalized || null;
  }

  private async ensureInvoiceNumberAvailable(
    invoiceNumber?: string | null,
    ignoreId?: string,
  ) {
    const normalized = this.normalizeInvoiceNumber(invoiceNumber);
    if (!normalized) return null;

    const existing = await (this.prisma as any).fuelRecord.findFirst({
      where: {
        invoiceNumber: normalized,
        ...(ignoreId ? { id: { not: ignoreId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException(
        `Nota ${normalized} já cadastrada. Não é permitido duplicar notas.`,
      );
    }

    return normalized;
  }

  private async calculateConsumption(
    vehicleId: string,
    km: number,
    liters: number,
    fuelDate: Date,
    ignoreRecordId?: string,
  ) {
    const previous = await (this.prisma as any).fuelRecord.findFirst({
      where: {
        vehicleId,
        ...(ignoreRecordId ? { id: { not: ignoreRecordId } } : {}),
        OR: [
          { fuelDate: { lt: fuelDate } },
          { fuelDate, km: { lt: km } },
        ],
      },
      orderBy: [{ fuelDate: 'desc' }, { km: 'desc' }],
      select: { km: true },
    });

    if (!previous) {
      return { averageConsumptionKmPerLiter: null, isAnomaly: false, anomalyReason: null };
    }

    const deltaKm = km - previous.km;
    if (deltaKm <= 0 || liters <= 0) {
      return {
        averageConsumptionKmPerLiter: null,
        isAnomaly: true,
        anomalyReason: 'Odometro inconsistente com abastecimento anterior',
      };
    }

    const avg = Number((deltaKm / liters).toFixed(2));

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { vehicleType: true },
    });

    const threshold = vehicle?.vehicleType === 'HEAVY' ? 2.5 : 5;
    if (avg < threshold) {
      return {
        averageConsumptionKmPerLiter: avg,
        isAnomaly: true,
        anomalyReason: `Consumo acima do esperado (${avg} km/L)`,
      };
    }

    return { averageConsumptionKmPerLiter: avg, isAnomaly: false, anomalyReason: null };
  }

  async create(dto: CreateFuelRecordDto) {
    await this.ensureVehicleExists(dto.vehicleId);
    if (dto.driverId) await this.ensureDriverExists(dto.driverId);
    const invoiceNumber = await this.ensureInvoiceNumberAvailable(
      dto.invoiceNumber,
    );

    const fuelDate = new Date(dto.fuelDate);
    const consumption = await this.calculateConsumption(
      dto.vehicleId,
      Math.round(dto.km),
      dto.liters,
      fuelDate,
    );

    let created: any;
    try {
      created = await (this.prisma as any).fuelRecord.create({
        data: {
          liters: dto.liters,
          totalValue: dto.totalValue,
          km: Math.round(dto.km),
          station: dto.station,
          invoiceNumber,
          fuelType: dto.fuelType,
          fuelDate,
          vehicleId: dto.vehicleId,
          driverId: dto.driverId ?? null,
          averageConsumptionKmPerLiter: consumption.averageConsumptionKmPerLiter,
          isAnomaly: consumption.isAnomaly,
          anomalyReason: consumption.anomalyReason,
        },
        include: this.includeVehicle,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          `Nota ${invoiceNumber || dto.invoiceNumber || ''} ja cadastrada. Nao e permitido duplicar notas.`,
        );
      }
      throw error;
    }

    await this.updateVehicleKm(created.vehicleId, created.km);
    return created;
  }

  async findAll() {
    return (this.prisma as any).fuelRecord.findMany({
      orderBy: { fuelDate: 'desc' },
      include: this.includeVehicle,
    });
  }

  async getInsights() {
    const records = await (this.prisma as any).fuelRecord.findMany({
      include: { vehicle: true, driver: true },
      orderBy: { fuelDate: 'desc' },
    });

    const comparisonMap = new Map<
      string,
      { vehicleId: string; label: string; liters: number; value: number; avgSum: number; avgCount: number; anomalies: number }
    >();

    for (const record of records) {
      const label = record.vehicle
        ? `${record.vehicle.plate} - ${record.vehicle.model}`
        : record.vehicleId;
      const item = comparisonMap.get(record.vehicleId) || {
        vehicleId: record.vehicleId,
        label,
        liters: 0,
        value: 0,
        avgSum: 0,
        avgCount: 0,
        anomalies: 0,
      };

      item.liters += record.liters;
      item.value += record.totalValue;
      if (record.averageConsumptionKmPerLiter) {
        item.avgSum += record.averageConsumptionKmPerLiter;
        item.avgCount += 1;
      }
      if (record.isAnomaly) item.anomalies += 1;
      comparisonMap.set(record.vehicleId, item);
    }

    const comparison = [...comparisonMap.values()]
      .map((item) => ({
        vehicleId: item.vehicleId,
        label: item.label,
        liters: Number(item.liters.toFixed(2)),
        totalValue: Number(item.value.toFixed(2)),
        averageConsumptionKmPerLiter:
          item.avgCount > 0 ? Number((item.avgSum / item.avgCount).toFixed(2)) : null,
        anomalies: item.anomalies,
      }))
      .sort((a, b) => b.totalValue - a.totalValue);

    const anomalies = records
      .filter((record) => record.isAnomaly)
      .map((record) => ({
        id: record.id,
        date: record.fuelDate,
        vehicle: record.vehicle ? `${record.vehicle.plate} - ${record.vehicle.model}` : record.vehicleId,
        driver: record.driver?.name || 'Sem motorista',
        averageConsumptionKmPerLiter: record.averageConsumptionKmPerLiter,
        reason: record.anomalyReason || 'Consumo fora da faixa',
      }));

    return {
      summary: {
        totalRecords: records.length,
        anomalies: anomalies.length,
      },
      comparison,
      anomalies,
    };
  }

  async findOne(id: string) {
    const record = await (this.prisma as any).fuelRecord.findUnique({
      where: { id },
      include: this.includeVehicle,
    });

    if (!record) throw new NotFoundException('Abastecimento nao encontrado');
    return record;
  }

  async update(id: string, dto: UpdateFuelRecordDto) {
    const previous = await this.findOne(id);

    if (!dto || Object.keys(dto).length === 0) {
      throw new BadRequestException('Envie ao menos um campo para atualizar.');
    }

    if (dto.vehicleId) {
      await this.ensureVehicleExists(dto.vehicleId);
    }
    if (dto.driverId) {
      await this.ensureDriverExists(dto.driverId);
    }
    const invoiceNumber =
      dto.invoiceNumber !== undefined
        ? await this.ensureInvoiceNumberAvailable(dto.invoiceNumber, id)
        : undefined;

    const nextVehicleId = dto.vehicleId ?? previous.vehicleId;
    const nextKm = dto.km !== undefined ? Math.round(dto.km) : previous.km;
    const nextLiters = dto.liters !== undefined ? dto.liters : previous.liters;
    const nextFuelDate = dto.fuelDate ? new Date(dto.fuelDate) : new Date(previous.fuelDate);

    const consumption = await this.calculateConsumption(
      nextVehicleId,
      nextKm,
      nextLiters,
      nextFuelDate,
      id,
    );

    const updated = await (this.prisma as any).fuelRecord.update({
      where: { id },
      data: {
        ...(dto.liters !== undefined ? { liters: dto.liters } : {}),
        ...(dto.totalValue !== undefined ? { totalValue: dto.totalValue } : {}),
        ...(dto.km !== undefined ? { km: Math.round(dto.km) } : {}),
        ...(dto.station !== undefined ? { station: dto.station } : {}),
        ...(dto.invoiceNumber !== undefined ? { invoiceNumber } : {}),
        ...(dto.fuelType !== undefined ? { fuelType: dto.fuelType } : {}),
        ...(dto.fuelDate !== undefined ? { fuelDate: new Date(dto.fuelDate) } : {}),
        ...(dto.vehicleId !== undefined ? { vehicleId: dto.vehicleId } : {}),
        ...(dto.driverId !== undefined ? { driverId: dto.driverId } : {}),
        averageConsumptionKmPerLiter: consumption.averageConsumptionKmPerLiter,
        isAnomaly: consumption.isAnomaly,
        anomalyReason: consumption.anomalyReason,
      },
      include: this.includeVehicle,
    });

    await this.updateVehicleKm(updated.vehicleId, updated.km);
    if (previous.vehicleId !== updated.vehicleId) {
      await this.recalculateVehicleKm(previous.vehicleId);
    }

    return updated;
  }

  async remove(id: string) {
    const record = await this.findOne(id);
    await (this.prisma as any).fuelRecord.delete({ where: { id } });
    await this.recalculateVehicleKm(record.vehicleId);
    return { message: 'Abastecimento removido com sucesso' };
  }

  async acknowledgeAnomaly(id: string) {
    await this.findOne(id);

    return (this.prisma as any).fuelRecord.update({
      where: { id },
      data: {
        isAnomaly: false,
        anomalyReason: 'CONFERIDO_MANUAL',
      },
      include: this.includeVehicle,
    });
  }

  private async ensureVehicleExists(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true },
    });

    if (!vehicle) throw new NotFoundException('Veiculo nao encontrado');
  }

  private async ensureDriverExists(driverId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { id: true },
    });

    if (!driver) throw new NotFoundException('Motorista nao encontrado');
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
