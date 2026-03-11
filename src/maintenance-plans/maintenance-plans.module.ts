import { Module } from '@nestjs/common';
import { MaintenancePlansController } from './maintenance-plans.controller';
import { MaintenancePlansService } from './maintenance-plans.service';

@Module({
  controllers: [MaintenancePlansController],
  providers: [MaintenancePlansService],
})
export class MaintenancePlansModule {}
