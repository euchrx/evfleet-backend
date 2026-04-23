import { Module } from '@nestjs/common';
import { TireMovementsController } from './tire-movements.controller';
import { TireMovementsService } from './tire-movements.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [TireMovementsController],
  providers: [TireMovementsService, PrismaService],
  exports: [TireMovementsService],
})
export class TireMovementsModule {}