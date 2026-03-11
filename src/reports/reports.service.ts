import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async vehicleCostSummary(vehicleId?: string) {
    const where = vehicleId ? { id: vehicleId } : undefined;
    const { vehicles, costByVehicleId } = await this.getVehicleCosts(where);

    return vehicles.map((vehicle) => ({
      vehicleId: vehicle.id,
      plate: vehicle.plate,
      vehicleName: vehicle.model,
      totalCost: costByVehicleId.get(vehicle.id) ?? 0,
    }));
  }

  async branchCostSummary() {
    const branches = await this.prisma.branch.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const { vehicles, costByVehicleId } = await this.getVehicleCosts();
    const branchCosts = new Map<string, number>();

    vehicles.forEach((vehicle) => {
      const totalCost = costByVehicleId.get(vehicle.id) ?? 0;
      const currentTotal = branchCosts.get(vehicle.branchId) ?? 0;
      branchCosts.set(vehicle.branchId, currentTotal + totalCost);
    });

    return branches.map((branch) => ({
      branchId: branch.id,
      branchName: branch.name,
      totalCost: branchCosts.get(branch.id) ?? 0,
    }));
  }

  async rankingMostExpensiveVehicles() {
    const summary = await this.vehicleCostSummary();
    return summary.sort((a, b) => b.totalCost - a.totalCost);
  }

  async vehicleConsumption(vehicleId: string) {
    const prisma = this.prisma as any;
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, plate: true, model: true },
    });

    if (!vehicle) return [];

    const records = await prisma.maintenanceRecord.findMany({
      where: { vehicleId },
      select: { cost: true, km: true },
      orderBy: { maintenanceDate: 'desc' },
      take: 20,
    });

    const totalCost = records.reduce((acc, record) => acc + record.cost, 0);
    const totalKm = records.reduce((acc, record) => acc + record.km, 0);
    const averageConsumption = totalKm > 0 ? totalCost / totalKm : 0;

    return [
      {
        vehicleId: vehicle.id,
        plate: vehicle.plate,
        vehicleName: vehicle.model,
        averageConsumption,
      },
    ];
  }

  private async getVehicleCosts(where?: { id: string }) {
    const prisma = this.prisma as any;
    const vehicles = await this.prisma.vehicle.findMany({
      where,
      select: {
        id: true,
        plate: true,
        model: true,
        branchId: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (vehicles.length === 0) {
      return {
        vehicles,
        costByVehicleId: new Map<string, number>(),
      };
    }

    const vehicleIds = vehicles.map((vehicle) => vehicle.id);

    const [maintenanceTotals, debtTotals] = await Promise.all([
      prisma.maintenanceRecord.groupBy({
        by: ['vehicleId'],
        where: { vehicleId: { in: vehicleIds } },
        _sum: { cost: true },
      }),
      prisma.debt.groupBy({
        by: ['vehicleId'],
        where: { vehicleId: { in: vehicleIds } },
        _sum: { amount: true },
      }),
    ]);

    const costByVehicleId = new Map<string, number>();

    maintenanceTotals.forEach((item) => {
      costByVehicleId.set(item.vehicleId, item._sum.cost ?? 0);
    });

    debtTotals.forEach((item) => {
      const current = costByVehicleId.get(item.vehicleId) ?? 0;
      costByVehicleId.set(item.vehicleId, current + (item._sum.amount ?? 0));
    });

    return { vehicles, costByVehicleId };
  }
}
