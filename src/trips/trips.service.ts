import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { AddTripProductDto } from './dto/add-trip-product.dto';

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);

  constructor(private readonly prisma: PrismaService) { }

  private readonly includeRelations = {
    vehicle: {
      include: {
        branch: true,
      },
    },
    driver: true,
  } as const;

  private readonly includeListRelations = {
    vehicle: {
      include: {
        branch: true,
      },
    },
    driver: true,
    products: {
      include: {
        dangerousProduct: true,
      },
    },
    mdfe: true,
  } as const;

  private readonly includeDetailsRelations = {
    vehicle: {
      include: {
        branch: true,
      },
    },
    driver: true,
    products: {
      include: {
        dangerousProduct: true,
      },
    },
    complianceChecks: {
      orderBy: {
        checkedAt: 'desc',
      },
      include: {
        results: true,
      },
    },
    generatedDocuments: {
      orderBy: {
        createdAt: 'desc',
      },
    },
    mdfe: true,
  } as const;

  async create(dto: CreateTripDto, req: any) {
    await this.ensureVehicleExists(dto.vehicleId);
    if (dto.driverId) await this.ensureDriverExists(dto.driverId);

    const companyId =
      req?.companyScopeId || req?.user?.companyId;

    if (!companyId) {
      throw new BadRequestException(
        'Selecione uma empresa antes de criar a viagem.',
      );
    }

    const created = await this.prisma.trip.create({
      data: {
        origin: dto.origin,
        destination: dto.destination,
        reason: dto.reason ?? null,
        departureKm: Math.round(dto.departureKm),
        returnKm:
          dto.returnKm !== undefined ? Math.round(dto.returnKm) : undefined,
        departureAt: new Date(dto.departureAt),
        returnAt: dto.returnAt ? new Date(dto.returnAt) : undefined,
        status: 'PENDING_COMPLIANCE',
        notes: dto.notes ?? null,
        vehicleId: dto.vehicleId,
        driverId: dto.driverId ?? null,

        // 🔥 AQUI ESTÁ O MAIS IMPORTANTE
        companyId,
      },
      include: this.includeDetailsRelations,
    });

    await this.updateVehicleKm(
      created.vehicleId,
      created.returnKm ?? created.departureKm,
    );

    return created;
  }

  async findAll() {
    return this.prisma.trip.findMany({
      orderBy: {
        departureAt: 'desc',
      },
      include: this.includeListRelations,
    });
  }

  async findOne(id: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      include: this.includeDetailsRelations,
    });

    if (!trip) {
      throw new NotFoundException('Viagem nao encontrada');
    }

    return trip;
  }

  async update(id: string, dto: UpdateTripDto) {
    const previous = await this.findOne(id);

    if (!dto || Object.keys(dto).length === 0) {
      throw new BadRequestException('Envie dados para atualizar.');
    }

    if (dto.vehicleId) await this.ensureVehicleExists(dto.vehicleId);
    if (dto.driverId) await this.ensureDriverExists(dto.driverId);

    const updated = await this.prisma.trip.update({
      where: { id },
      data: {
        ...(dto.origin !== undefined ? { origin: dto.origin } : {}),
        ...(dto.destination !== undefined
          ? { destination: dto.destination }
          : {}),
        ...(dto.reason !== undefined ? { reason: dto.reason || null } : {}),
        ...(dto.departureKm !== undefined
          ? { departureKm: Math.round(dto.departureKm) }
          : {}),
        ...(dto.returnKm !== undefined
          ? { returnKm: Math.round(dto.returnKm) }
          : {}),
        ...(dto.departureAt !== undefined
          ? { departureAt: new Date(dto.departureAt) }
          : {}),
        ...(dto.returnAt !== undefined
          ? { returnAt: dto.returnAt ? new Date(dto.returnAt) : null }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
        ...(dto.vehicleId !== undefined ? { vehicleId: dto.vehicleId } : {}),
        ...(dto.driverId !== undefined ? { driverId: dto.driverId || null } : {}),
      },
      include: this.includeDetailsRelations,
    });

    await this.updateVehicleKm(
      updated.vehicleId,
      updated.returnKm ?? updated.departureKm,
    );

    if (previous.vehicleId !== updated.vehicleId) {
      await this.recalculateVehicleKm(previous.vehicleId);
    }

    return updated;
  }

  async remove(id: string) {
    const trip = await this.findOne(id);

    await this.prisma.trip.delete({
      where: { id },
    });

    await this.recalculateVehicleKm(trip.vehicleId);

    return { message: 'Viagem removida com sucesso' };
  }

  async startTrip(id: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      include: {
        complianceChecks: {
          orderBy: {
            checkedAt: 'desc',
          },
          take: 1,
        },
        mdfe: {
          select: {
            id: true,
            status: true,
          },
          take: 1,
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!trip) {
      throw new NotFoundException('Viagem nao encontrada');
    }

    const lastCompliance = trip.complianceChecks[0];

    if (!lastCompliance || lastCompliance.status !== 'APPROVED') {
      throw new BadRequestException(
        'Viagem nao aprovada no compliance. Valide a viagem antes de iniciar.',
      );
    }

    const mdfe = trip.mdfe?.[0];

    const hasMdfe =
        ['AUTHORIZED', 'PROCESSING', 'CLOSED'].includes(mdfe.status);

    if (!hasMdfe) {
      throw new BadRequestException('MDF-e nao gerado para a viagem.');
    }

    return this.prisma.trip.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
      },
      include: this.includeDetailsRelations,
    });
  }

  async addProduct(tripId: string, dto: AddTripProductDto) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
    });

    if (!trip) {
      throw new NotFoundException('Viagem nao encontrada');
    }

    const product = await this.prisma.dangerousProduct.findUnique({
      where: { id: dto.dangerousProductId },
    });

    if (!product) {
      throw new NotFoundException('Produto perigoso nao encontrado');
    }

    return this.prisma.tripProduct.create({
      data: {
        tripId,
        dangerousProductId: dto.dangerousProductId,
        quantity: new Prisma.Decimal(dto.quantity),
        unit: dto.unit,
        tankCompartment: dto.tankCompartment ?? null,
        invoiceKey: dto.invoiceKey ?? null,
        invoiceNumber: dto.invoiceNumber ?? null,
      },
      include: {
        dangerousProduct: true,
      },
    });
  }

  async findProducts(tripId: string) {
    return this.prisma.tripProduct.findMany({
      where: { tripId },
      include: {
        dangerousProduct: true,
      },
    });
  }

  async removeProduct(tripId: string, tripProductId: string) {
    const item = await this.prisma.tripProduct.findFirst({
      where: {
        id: tripProductId,
        tripId,
      },
    });

    if (!item) {
      throw new NotFoundException('Produto da viagem nao encontrado');
    }

    return this.prisma.tripProduct.delete({
      where: { id: tripProductId },
    });
  }

  private async ensureVehicleExists(vehicleId: string) {
    const exists = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('Veiculo nao encontrado');
    }
  }

  private async ensureDriverExists(driverId: string) {
    const exists = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('Motorista nao encontrado');
    }
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
      this.prisma.fuelRecord.findFirst({
        where: { vehicleId },
        orderBy: { km: 'desc' },
        select: { km: true },
      }),
      this.prisma.maintenanceRecord.findFirst({
        where: { vehicleId },
        orderBy: { km: 'desc' },
        select: { km: true },
      }),
      this.prisma.trip.findFirst({
        where: { vehicleId },
        orderBy: { returnKm: 'desc' },
        select: { departureKm: true, returnKm: true },
      }),
    ]);

    const tripKm = Math.max(
      lastTrip?.returnKm ?? 0,
      lastTrip?.departureKm ?? 0,
    );

    const nextKm = Math.max(
      lastFuel?.km ?? 0,
      lastMaintenance?.km ?? 0,
      tripKm,
    );

    await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { currentKm: nextKm },
    });
  }
}