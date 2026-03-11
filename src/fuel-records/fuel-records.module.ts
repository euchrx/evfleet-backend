import { Module } from '@nestjs/common';
import { FuelRecordsController } from './fuel-records.controller';
import { FuelRecordsService } from './fuel-records.service';

@Module({
  controllers: [FuelRecordsController],
  providers: [FuelRecordsService],
})
export class FuelRecordsModule {}

