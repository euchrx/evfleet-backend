import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('trips')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Post(':id/validate-compliance')
  validateTrip(@Param('id') tripId: string) {
    return this.complianceService.validateTrip(tripId);
  }
}