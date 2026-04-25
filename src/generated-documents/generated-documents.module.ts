import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { GeneratedDocumentsController } from './generated-documents.controller';
import { GeneratedDocumentsService } from './generated-documents.service';
import { MdfeModule } from 'src/integrations/mdfe/mdfe.module';

@Module({
  imports: [PrismaModule, MdfeModule],
  controllers: [GeneratedDocumentsController],
  providers: [GeneratedDocumentsService],
  exports: [GeneratedDocumentsService],
})
export class GeneratedDocumentsModule {}