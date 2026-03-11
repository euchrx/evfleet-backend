import { Body, Controller, Get, Post } from '@nestjs/common';
import { CostCentersService } from './cost-centers.service';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';

@Controller('cost-centers')
export class CostCentersController {
  constructor(private readonly service: CostCentersService) {}

  @Post()
  create(@Body() dto: CreateCostCenterDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }
}