import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { MaintenanceRecordsService } from './maintenance-records.service';
import { CreateMaintenanceRecordDto } from './dto/create-maintenance-record.dto';
import { UpdateMaintenanceRecordDto } from './dto/update-maintenance-record.dto';

@Controller('maintenance-records')
export class MaintenanceRecordsController {
  constructor(
    private readonly maintenanceRecordsService: MaintenanceRecordsService,
  ) {}

  @Post()
  create(@Body() dto: CreateMaintenanceRecordDto) {
    return this.maintenanceRecordsService.create(dto);
  }

  @Get()
  findAll() {
    return this.maintenanceRecordsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.maintenanceRecordsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMaintenanceRecordDto) {
    return this.maintenanceRecordsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.maintenanceRecordsService.remove(id);
  }
}

