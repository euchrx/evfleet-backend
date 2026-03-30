import { Module } from '@nestjs/common';
import { FuelRecordsController } from './fuel-records.controller';
import { FuelRecordsService } from './fuel-records.service';
import { XmlImportModule } from '../xml-import/xml-import.module';

@Module({
  imports: [XmlImportModule],
  controllers: [FuelRecordsController],
  providers: [FuelRecordsService],
})
export class FuelRecordsModule {}
