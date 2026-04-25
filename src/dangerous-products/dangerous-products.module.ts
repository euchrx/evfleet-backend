import { Module } from '@nestjs/common';
import { DangerousProductsController } from './dangerous-products.controller';
import { DangerousProductsService } from './dangerous-products.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DangerousProductsController],
  providers: [DangerousProductsService],
  exports: [DangerousProductsService],
})
export class DangerousProductsModule {}