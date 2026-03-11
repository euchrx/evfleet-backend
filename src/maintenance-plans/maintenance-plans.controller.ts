import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateMaintenancePlanDto } from './dto/create-maintenance-plan.dto';
import { UpdateMaintenancePlanDto } from './dto/update-maintenance-plan.dto';
import { MaintenancePlansService } from './maintenance-plans.service';

@Controller('maintenance-plans')
export class MaintenancePlansController {
  constructor(private readonly maintenancePlansService: MaintenancePlansService) {}

  @Post()
  create(@Body() dto: CreateMaintenancePlanDto) {
    return this.maintenancePlansService.create(dto);
  }

  @Get()
  findAll() {
    return this.maintenancePlansService.findAll();
  }

  @Get('agenda')
  getAgenda() {
    return this.maintenancePlansService.getAgenda();
  }

  @Get('alerts')
  getAlerts() {
    return this.maintenancePlansService.getAlerts();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.maintenancePlansService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMaintenancePlanDto) {
    return this.maintenancePlansService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.maintenancePlansService.remove(id);
  }
}
