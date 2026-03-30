import { Module } from '@nestjs/common';
import { XmlImportModule } from '../xml-import/xml-import.module';
import { RetailProductsController } from './retail-products.controller';

@Module({
  imports: [XmlImportModule],
  controllers: [RetailProductsController],
})
export class RetailProductsModule {}

