import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { TireMovementsService } from './tire-movements.service';
import { CreateTireMovementDto } from './dto/create-tire-movement.dto';

@UseGuards(JwtAuthGuard)
@Controller('tire-movements')
export class TireMovementsController {
  constructor(private readonly tireMovementsService: TireMovementsService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateTireMovementDto) {
    return this.tireMovementsService.create(req.user.companyId, dto);
  }

  @Get()
  findAll(
    @Req() req: any,
    @Query('vehicleId') vehicleId?: string,
    @Query('tireId') tireId?: string,
  ) {
    return this.tireMovementsService.findAll(req.user.companyId, vehicleId, tireId);
  }
}