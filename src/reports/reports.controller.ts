import { Controller, Get, Param, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('vehicle-cost-summary')
  vehicleCostSummary(@Query('vehicleId') vehicleId?: string) {
    return this.reportsService.vehicleCostSummary(vehicleId);
  }

  @Get('branch-cost-summary')
  branchCostSummary() {
    return this.reportsService.branchCostSummary();
  }

  @Get('ranking-most-expensive-vehicles')
  rankingMostExpensiveVehicles() {
    return this.reportsService.rankingMostExpensiveVehicles();
  }

  @Get('vehicle-consumption/:vehicleId')
  vehicleConsumption(@Param('vehicleId') vehicleId: string) {
    return this.reportsService.vehicleConsumption(vehicleId);
  }
}

