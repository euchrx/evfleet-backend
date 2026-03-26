import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SystemResetService {
  constructor(private readonly prisma: PrismaService) {}

  async resetAllDatabase(jwtSecretToken: string) {
    const configuredSecret = String(process.env.JWT_SECRET || '').trim();
    if (!configuredSecret) {
      throw new InternalServerErrorException('JWT_SECRET não configurado no servidor.');
    }
    if (String(jwtSecretToken || '').trim() !== configuredSecret) {
      throw new UnauthorizedException('Token JWT_SECRET inválido para executar reset.');
    }

    const safeDeleteMany = async (
      operation: () => Promise<{ count: number }>,
    ) => {
      try {
        return await operation();
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2021'
        ) {
          return { count: 0 };
        }

        if (error instanceof Prisma.PrismaClientUnknownRequestError) {
          const message = String(error.message || '').toLowerCase();
          const missingRelation =
            message.includes('does not exist') ||
            message.includes('relation') ||
            message.includes('table');
          if (missingRelation) {
            return { count: 0 };
          }
        }

        throw error;
      }
    };

    const tireReadings = await safeDeleteMany(() =>
      this.prisma.tireReading.deleteMany(),
    );
    const fuelRecords = await safeDeleteMany(() =>
      this.prisma.fuelRecord.deleteMany(),
    );
    const maintenanceRecords = await safeDeleteMany(() =>
      this.prisma.maintenanceRecord.deleteMany(),
    );
    const maintenancePlans = await safeDeleteMany(() =>
      this.prisma.maintenancePlan.deleteMany(),
    );
    const debts = await safeDeleteMany(() => this.prisma.debt.deleteMany());
    const trips = await safeDeleteMany(() => this.prisma.trip.deleteMany());
    const vehicleDocuments = await safeDeleteMany(() =>
      this.prisma.vehicleDocument.deleteMany(),
    );
    const vehicleChangeLogs = await safeDeleteMany(() =>
      this.prisma.vehicleChangeLog.deleteMany(),
    );
    const tires = await safeDeleteMany(() => this.prisma.tire.deleteMany());
    const drivers = await safeDeleteMany(() => this.prisma.driver.deleteMany());
    const vehicles = await safeDeleteMany(() => this.prisma.vehicle.deleteMany());
    const branches = await safeDeleteMany(() => this.prisma.branch.deleteMany());
    const costCenters = await safeDeleteMany(() =>
      this.prisma.costCenter.deleteMany(),
    );
    const systemSettings = await safeDeleteMany(() =>
      this.prisma.systemSetting.deleteMany(),
    );
    const auditLogs = await safeDeleteMany(() => this.prisma.auditLog.deleteMany());

    const result = {
      tireReadings: tireReadings.count,
      fuelRecords: fuelRecords.count,
      maintenanceRecords: maintenanceRecords.count,
      maintenancePlans: maintenancePlans.count,
      debts: debts.count,
      trips: trips.count,
      vehicleDocuments: vehicleDocuments.count,
      vehicleChangeLogs: vehicleChangeLogs.count,
      tires: tires.count,
      drivers: drivers.count,
      vehicles: vehicles.count,
      branches: branches.count,
      costCenters: costCenters.count,
      systemSettings: systemSettings.count,
      auditLogs: auditLogs.count,
    };

    return {
      message: 'Reset do banco concluído com sucesso.',
      preserved: ['users'],
      deleted: result,
    };
  }
}
