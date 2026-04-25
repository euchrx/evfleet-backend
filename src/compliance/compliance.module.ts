import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import { DriverMoppRule } from './rules/driver-mopp.rule';
import { GeneratedDocumentsRule } from './rules/generated-documents.rule';
import { ProductFispqRule } from './rules/product-fispq.rule';
import { VehicleCippRule } from './rules/vehicle-cipp.rule';
import { VehicleCivRule } from './rules/vehicle-civ.rule';
import { VehicleCrlvRule } from './rules/vehicle-crlv.rule';

@Module({
  imports: [PrismaModule],
  controllers: [ComplianceController],
  providers: [
    ComplianceService,
    DriverMoppRule,
    VehicleCippRule,
    VehicleCivRule,
    VehicleCrlvRule,
    ProductFispqRule,
  ],
  exports: [ComplianceService],
})
export class ComplianceModule {}