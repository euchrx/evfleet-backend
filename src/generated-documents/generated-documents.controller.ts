import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { GeneratedDocumentsService } from './generated-documents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('trips')
export class GeneratedDocumentsController {
  constructor(
    private readonly generatedDocumentsService: GeneratedDocumentsService,
  ) {}

  @Post(':id/generate-emergency-sheet')
  generateEmergencySheet(@Param('id') tripId: string) {
    return this.generatedDocumentsService.generateEmergencySheet(tripId);
  }

  @Post(':id/generate-mdfe')
  generateMdfeMock(@Param('id') tripId: string) {
    return this.generatedDocumentsService.generateMdfeMock(tripId);
  }
}