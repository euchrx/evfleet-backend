import { Module } from '@nestjs/common';
import { MaintenanceRecordsController } from './maintenance-records.controller';
import { MaintenanceRecordsService } from './maintenance-records.service';

@Module({
  controllers: [MaintenanceRecordsController],
  providers: [MaintenanceRecordsService],
})
export class MaintenanceRecordsModule {}

