import { Module } from '@nestjs/common';
import { XmlImportController } from './xml-import.controller';
import { XmlImportService } from './xml-import.service';

@Module({
  controllers: [XmlImportController],
  providers: [XmlImportService],
})
export class XmlImportModule {}

