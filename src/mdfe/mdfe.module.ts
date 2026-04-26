import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MdfeModule as MdfeProviderModule } from 'src/integrations/mdfe/mdfe.module';
import { MdfeController } from './mdfe.controller';
import { MdfeService } from './mdfe.service';
import { DamdfeService } from './damdfe.service';

@Module({
  imports: [PrismaModule, MdfeProviderModule],
  controllers: [MdfeController],
  providers: [MdfeService, DamdfeService],
  exports: [MdfeService],
})
export class MdfeModule {}