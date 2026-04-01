import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportXmlZipDto } from '../xml-import/dto/import-xml-zip.dto';
import { XmlImportService } from '../xml-import/xml-import.service';

@Controller('retail-products')
export class RetailProductsController {
  constructor(private readonly xmlImportService: XmlImportService) {}

  @Get()
  listItems(
    @Req() req: any,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('supplier') supplier?: string,
    @Query('invoiceNumber') invoiceNumber?: string,
    @Query('itemDescription') itemDescription?: string,
    @Query('category') category?: string,
  ) {
    return this.xmlImportService.listRetailProductItems(
      this.resolveCompanyIdFromUser(req),
      {
        dateFrom,
        dateTo,
        supplier,
        invoiceNumber,
        itemDescription,
        category,
      },
    );
  }

  @Post('import-xml')
  @UseInterceptors(FileInterceptor('file'))
  importXml(
    @UploadedFile() file: { buffer?: Buffer; originalname?: string } | undefined,
    @Body() dto: ImportXmlZipDto,
    @Req() req: any,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Envie um arquivo ZIP valido no campo file.');
    }

    const fileName = String(file.originalname || '').trim();
    if (!fileName.toLowerCase().endsWith('.zip')) {
      throw new BadRequestException('O arquivo enviado deve ser um ZIP.');
    }

    return this.xmlImportService.importZipByDomain({
      companyId: this.resolveCompanyIdFromUser(req),
      branchId: dto.branchId,
      periodLabel: dto.periodLabel,
      fileName: file.originalname || 'importacao.zip',
      zipBuffer: file.buffer,
      domain: 'RETAIL_PRODUCT',
    });
  }

  @Get('imported-xml')
  getImportedXml(
    @Req() req: any,
    @Query('period') period?: string,
    @Query('issuerName') issuerName?: string,
    @Query('number') number?: string,
    @Query('processingStatus') processingStatus?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.xmlImportService.listInvoicesByDomain(
      this.resolveCompanyIdFromUser(req),
      'RETAIL_PRODUCT',
      { period, issuerName, number, processingStatus, dateFrom, dateTo },
    );
  }

  private resolveCompanyIdFromUser(req: any): string {
    const companyId = String(req?.companyScopeId || req?.user?.companyId || '').trim();
    if (!companyId) {
      throw new BadRequestException(
        'Usuario autenticado sem companyId para importacao XML.',
      );
    }
    return companyId;
  }
}
