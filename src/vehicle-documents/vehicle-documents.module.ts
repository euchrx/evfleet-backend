import { Module } from '@nestjs/common';
import { VehicleDocumentsController } from './vehicle-documents.controller';
import { VehicleDocumentsService } from './vehicle-documents.service';

@Module({
  controllers: [VehicleDocumentsController],
  providers: [VehicleDocumentsService],
})
export class VehicleDocumentsModule {}
