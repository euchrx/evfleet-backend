import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SystemResetService {
  constructor(private readonly prisma: PrismaService) {}

  async resetAllDatabase() {
    const result = await this.prisma.$transaction(async (tx) => {
      const tireReadings = await tx.tireReading.deleteMany();
      const fuelRecords = await tx.fuelRecord.deleteMany();
      const maintenanceRecords = await tx.maintenanceRecord.deleteMany();
      const maintenancePlans = await tx.maintenancePlan.deleteMany();
      const debts = await tx.debt.deleteMany();
      const trips = await tx.trip.deleteMany();
      const vehicleDocuments = await tx.vehicleDocument.deleteMany();
      const vehicleChangeLogs = await tx.vehicleChangeLog.deleteMany();
      const tires = await tx.tire.deleteMany();
      const drivers = await tx.driver.deleteMany();
      const vehicles = await tx.vehicle.deleteMany();
      const branches = await tx.branch.deleteMany();
      const costCenters = await tx.costCenter.deleteMany();
      const systemSettings = await tx.systemSetting.deleteMany();
      const auditLogs = await tx.auditLog.deleteMany();

      return {
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
    });

    return {
      message: 'Reset do banco concluído com sucesso.',
      preserved: ['users'],
      deleted: result,
    };
  }
}

