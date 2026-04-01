import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FuelType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { XmlImportService } from '../xml-import/xml-import.service';
import { CreateFuelRecordDto } from './dto/create-fuel-record.dto';
import { ConfirmFuelXmlPreviewDto } from './dto/confirm-fuel-xml-preview.dto';
import { UpdateFuelRecordDto } from './dto/update-fuel-record.dto';

@Injectable()
export class FuelRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly xmlImportService: XmlImportService,
  ) {}

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

  private normalizePlate(value?: string | null) {
    const normalized = String(value || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    return normalized || null;
  }

  private normalizeSourceProductCode(
    productCode?: string | null,
    lineIndex?: number,
  ) {
    const normalized = String(productCode || '').trim().toUpperCase();
    if (normalized) return normalized;
    return `__LINE_${lineIndex || 0}__`;
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
        OR: [{ fuelDate: { lt: fuelDate } }, { fuelDate, km: { lt: km } }],
      },
      orderBy: [{ fuelDate: 'desc' }, { km: 'desc' }],
      select: { km: true },
    });

    if (!previous) {
      return {
        averageConsumptionKmPerLiter: null,
        isAnomaly: false,
        anomalyReason: null,
      };
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

    return {
      averageConsumptionKmPerLiter: avg,
      isAnomaly: false,
      anomalyReason: null,
    };
  }

  async create(dto: CreateFuelRecordDto) {
    await this.ensureVehicleExists(dto.vehicleId);
    if (dto.driverId) await this.ensureDriverExists(dto.driverId);
    const invoiceNumber = this.normalizeInvoiceNumber(dto.invoiceNumber);

    const fuelDate = new Date(dto.fuelDate);
    const consumption = await this.calculateConsumption(
      dto.vehicleId,
      Math.round(dto.km),
      dto.liters,
      fuelDate,
    );

    const created = await (this.prisma as any).fuelRecord.create({
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

    if (created.vehicleId) {
      await this.updateVehicleKm(created.vehicleId, created.km);
    }
    return created;
  }

  async previewXmlImport(
    companyId: string,
    files: Array<{ buffer?: Buffer; originalname?: string }>,
  ) {
    return this.xmlImportService.previewFuelXmlFiles({
      companyId,
      files: files
        .filter((file): file is { buffer: Buffer; originalname?: string } =>
          Boolean(file?.buffer?.length),
        )
        .map((file) => ({
          buffer: file.buffer,
          originalname: file.originalname,
        })),
    });
  }

  async confirmXmlImport(companyId: string, dto: ConfirmFuelXmlPreviewDto) {
    const normalizedCompanyId = String(companyId || '').trim();
    if (!normalizedCompanyId) {
      throw new BadRequestException('companyId obrigatorio para confirmar importacao.');
    }

    const invoices = Array.isArray(dto.invoices) ? dto.invoices : [];
    if (invoices.length === 0) {
      throw new BadRequestException('Nenhuma nota foi enviada para confirmacao.');
    }

    const totalItemsDetected = invoices.reduce(
      (acc, invoice) => acc + invoice.items.length,
      0,
    );
    const totalDuplicados = invoices.reduce(
      (acc, invoice) => acc + invoice.items.filter((item) => item.duplicate).length,
      0,
    );

    let totalImportados = 0;
    let totalIgnorados = 0;

    for (const invoice of invoices) {
      for (const item of invoice.items) {
        if (!item.selected) {
          if (!item.duplicate) {
            totalIgnorados += 1;
          }
          continue;
        }

        if (!item.importable || item.duplicate) {
          if (!item.duplicate) {
            totalIgnorados += 1;
          }
          continue;
        }

        const duplicateCheck = await this.xmlImportService.findFuelImportDuplicate({
          companyId: normalizedCompanyId,
          invoiceKey: invoice.invoiceKey,
          invoiceNumber: invoice.invoiceNumber,
          lineIndex: item.lineIndex,
          productCode: item.productCode,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          plate: invoice.plate,
          fuelDateTime: item.fuelDateTime ? new Date(item.fuelDateTime) : undefined,
        });

        if (duplicateCheck.duplicate) {
          continue;
        }

        const vehicle = await this.resolveVehicleForImport(
          normalizedCompanyId,
          invoice.plate,
        );
        if (!vehicle) {
          totalIgnorados += 1;
          continue;
        }

        try {
          await this.createImportedFuelRecord({
            companyId: normalizedCompanyId,
            vehicleId: vehicle.id,
            currentKm: vehicle.currentKm,
            invoiceKey: invoice.invoiceKey,
            invoiceNumber: invoice.invoiceNumber,
            supplierName: invoice.supplierName,
            plate: invoice.plate,
            odometer: invoice.odometer,
            lineIndex: item.lineIndex,
            productCode: item.productCode,
            quantity: item.quantity,
            totalPrice: item.totalPrice,
            detectedFuelType: item.detectedFuelType,
            fuelDateTime: item.fuelDateTime,
          });
          totalImportados += 1;
        } catch (error) {
          if (this.isFuelXmlDuplicateConflict(error)) {
            continue;
          }
          throw error;
        }
      }
    }

    return {
      totalInvoicesRead: new Set(invoices.map((invoice) => invoice.invoiceKey)).size,
      totalItemsDetected,
      totalImported: totalImportados,
      totalIgnored: totalIgnorados,
      totalDuplicated: totalDuplicados + Math.max(0, totalItemsDetected - totalImportados - totalIgnorados - totalDuplicados),
    };
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
      {
        vehicleId: string;
        label: string;
        liters: number;
        value: number;
        avgSum: number;
        avgCount: number;
        anomalies: number;
      }
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
          item.avgCount > 0
            ? Number((item.avgSum / item.avgCount).toFixed(2))
            : null,
        anomalies: item.anomalies,
      }))
      .sort((a, b) => b.totalValue - a.totalValue);

    const anomalies = records
      .filter((record) => record.isAnomaly)
      .map((record) => ({
        id: record.id,
        date: record.fuelDate,
        vehicle: record.vehicle
          ? `${record.vehicle.plate} - ${record.vehicle.model}`
          : record.vehicleId,
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
        ? this.normalizeInvoiceNumber(dto.invoiceNumber)
        : undefined;

    const nextVehicleId = dto.vehicleId ?? previous.vehicleId;
    const nextKm = dto.km !== undefined ? Math.round(dto.km) : previous.km;
    const nextLiters = dto.liters !== undefined ? dto.liters : previous.liters;
    const nextFuelDate = dto.fuelDate
      ? new Date(dto.fuelDate)
      : new Date(previous.fuelDate);

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
        ...(dto.fuelDate !== undefined
          ? { fuelDate: new Date(dto.fuelDate) }
          : {}),
        ...(dto.vehicleId !== undefined ? { vehicleId: dto.vehicleId } : {}),
        ...(dto.driverId !== undefined ? { driverId: dto.driverId } : {}),
        averageConsumptionKmPerLiter: consumption.averageConsumptionKmPerLiter,
        isAnomaly: consumption.isAnomaly,
        anomalyReason: consumption.anomalyReason,
      },
      include: this.includeVehicle,
    });

    if (updated.vehicleId) {
      await this.updateVehicleKm(updated.vehicleId, updated.km);
    }
    if (previous.vehicleId && previous.vehicleId !== updated.vehicleId) {
      await this.recalculateVehicleKm(previous.vehicleId);
    }

    return updated;
  }

  async remove(id: string) {
    const record = await this.findOne(id);
    await (this.prisma as any).fuelRecord.delete({ where: { id } });
    if (record.vehicleId) {
      await this.recalculateVehicleKm(record.vehicleId);
    }
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

  private async resolveVehicleForImport(companyId: string, plate?: string) {
    const normalizedPlate = this.normalizePlate(plate);
    if (!normalizedPlate) return null;

    return this.prisma.vehicle.findFirst({
      where: {
        companyId,
        plate: normalizedPlate,
      },
      select: {
        id: true,
        currentKm: true,
      },
    });
  }

  private mapDetectedFuelTypeToRecordFuelType(detectedFuelType?: string) {
    const normalized = String(detectedFuelType || '').trim().toUpperCase();

    switch (normalized) {
      case 'ETHANOL':
        return FuelType.ETHANOL;
      case 'DIESEL':
      case 'S10':
      case 'S500':
        return FuelType.DIESEL;
      case 'ARLA32':
        return FuelType.ARLA32;
      case 'FLEX':
        return FuelType.FLEX;
      default:
        return FuelType.GASOLINE;
    }
  }

  private async createImportedFuelRecord(input: {
    companyId: string;
    vehicleId: string;
    currentKm: number;
    invoiceKey: string;
    invoiceNumber?: string;
    supplierName?: string;
    plate?: string;
    odometer?: number;
    lineIndex: number;
    productCode?: string;
    quantity: number;
    totalPrice: number;
    detectedFuelType?: string;
    fuelDateTime?: string;
  }) {
    const liters = Number(input.quantity || 0);
    if (!(liters > 0)) {
      throw new BadRequestException('Quantidade do item deve ser maior que zero.');
    }

    const fuelDate =
      (input.fuelDateTime ? new Date(input.fuelDateTime) : null) || new Date();
    const km =
      typeof input.odometer === 'number' && input.odometer >= 0
        ? Math.round(input.odometer)
        : input.currentKm;
    const sourceProductCode = this.normalizeSourceProductCode(
      input.productCode,
      input.lineIndex,
    );

    const consumption = await this.calculateConsumption(
      input.vehicleId,
      km,
      liters,
      fuelDate,
    );

    const created = await this.prisma.fuelRecord.create({
      data: {
        invoiceNumber:
          this.normalizeInvoiceNumber(input.invoiceNumber) || input.invoiceKey,
        liters,
        totalValue: Number(input.totalPrice || 0),
        km,
        station: String(input.supplierName || 'Fornecedor nao informado').trim(),
        fuelType: this.mapDetectedFuelTypeToRecordFuelType(
          input.detectedFuelType,
        ),
        fuelDate,
        vehicleId: input.vehicleId,
        driverId: null,
        averageConsumptionKmPerLiter: consumption.averageConsumptionKmPerLiter,
        isAnomaly: consumption.isAnomaly,
        anomalyReason: consumption.anomalyReason,
        sourceInvoiceKey: input.invoiceKey,
        sourceInvoiceLineIndex: input.lineIndex,
        sourceProductCode,
        sourcePlate: this.normalizePlate(input.plate),
        sourceFuelDateTime: fuelDate,
      },
      include: this.includeVehicle,
    });

    if (created.vehicleId) {
      await this.updateVehicleKm(created.vehicleId, created.km);
    }
    return created;
  }

  private isFuelXmlDuplicateConflict(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
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
