import { Module } from '@nestjs/common';
import { XmlImportModule } from '../xml-import/xml-import.module';
import { ProductsController } from './products.controller';
import { RetailProductsController } from './retail-products.controller';

@Module({
  imports: [XmlImportModule],
  controllers: [RetailProductsController, ProductsController],
})
export class RetailProductsModule {}
