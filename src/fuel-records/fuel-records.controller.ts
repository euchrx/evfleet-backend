import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { FuelRecordsService } from './fuel-records.service';
import { CreateFuelRecordDto } from './dto/create-fuel-record.dto';
import { UpdateFuelRecordDto } from './dto/update-fuel-record.dto';

@Controller('fuel-records')
export class FuelRecordsController {
  constructor(private readonly fuelRecordsService: FuelRecordsService) {}

  @Post()
  create(@Body() dto: CreateFuelRecordDto) {
    return this.fuelRecordsService.create(dto);
  }

  @Get()
  findAll() {
    return this.fuelRecordsService.findAll();
  }

  @Get('insights')
  getInsights() {
    return this.fuelRecordsService.getInsights();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.fuelRecordsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFuelRecordDto) {
    return this.fuelRecordsService.update(id, dto);
  }

  @Patch(':id/acknowledge-anomaly')
  acknowledgeAnomaly(@Param('id') id: string) {
    return this.fuelRecordsService.acknowledgeAnomaly(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.fuelRecordsService.remove(id);
  }
}
