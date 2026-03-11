import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { TiresService } from './tires.service';
import { CreateTireDto } from './dto/create-tire.dto';
import { UpdateTireDto } from './dto/update-tire.dto';
import { CreateTireReadingDto } from './dto/create-tire-reading.dto';

@Controller('tires')
export class TiresController {
  constructor(private readonly tiresService: TiresService) {}

  @Post()
  create(@Body() dto: CreateTireDto) {
    return this.tiresService.create(dto);
  }

  @Get()
  findAll() {
    return this.tiresService.findAll();
  }

  @Get('alerts/summary')
  getAlertsSummary() {
    return this.tiresService.getAlertsSummary();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tiresService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTireDto) {
    return this.tiresService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tiresService.remove(id);
  }

  @Post(':id/readings')
  createReading(@Param('id') id: string, @Body() dto: CreateTireReadingDto) {
    return this.tiresService.createReading(id, dto);
  }

  @Get(':id/readings')
  getReadings(@Param('id') id: string) {
    return this.tiresService.getReadings(id);
  }
}
