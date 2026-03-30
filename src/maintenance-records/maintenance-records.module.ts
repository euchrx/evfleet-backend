import { Module } from '@nestjs/common';
import { MaintenanceRecordsController } from './maintenance-records.controller';
import { MaintenanceRecordsService } from './maintenance-records.service';
import { XmlImportModule } from '../xml-import/xml-import.module';

@Module({
  imports: [XmlImportModule],
  controllers: [MaintenanceRecordsController],
  providers: [MaintenanceRecordsService],
})
export class MaintenanceRecordsModule {}
