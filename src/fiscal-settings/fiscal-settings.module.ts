import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { FiscalSettingsController } from './fiscal-settings.controller';
import { FiscalSettingsService } from './fiscal-settings.service';

@Module({
  imports: [PrismaModule],
  controllers: [FiscalSettingsController],
  providers: [FiscalSettingsService],
  exports: [FiscalSettingsService],
})
export class FiscalSettingsModule {}