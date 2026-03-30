import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DeleteXmlInvoicesDto } from './dto/delete-xml-invoices.dto';
import { ImportXmlZipDto } from './dto/import-xml-zip.dto';
import { LinkCostRecordDto } from './dto/link-cost-record.dto';
import { LinkFuelRecordDto } from './dto/link-fuel-record.dto';
import { LinkMaintenanceRecordDto } from './dto/link-maintenance-record.dto';
import { XmlImportService } from './xml-import.service';

@Controller('xml-import')
export class XmlImportController {
  constructor(private readonly xmlImportService: XmlImportService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  importZip(
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

    const companyId = this.resolveCompanyIdFromUser(req);

    return this.xmlImportService.importZip({
      companyId,
      branchId: dto.branchId,
      periodLabel: dto.periodLabel,
      fileName: file.originalname || 'importacao.zip',
      zipBuffer: file.buffer,
    });
  }

  @Get('batches')
  listBatches(@Req() req: any) {
    const companyId = this.resolveCompanyIdFromUser(req);
    return this.xmlImportService.listBatches(companyId);
  }

  @Get('batches/:id')
  getBatchById(@Param('id') id: string, @Req() req: any) {
    const companyId = this.resolveCompanyIdFromUser(req);
    return this.xmlImportService.getBatchById(companyId, id);
  }

  @Delete('batches/:id')
  deleteBatchById(@Param('id') id: string, @Req() req: any) {
    const companyId = this.resolveCompanyIdFromUser(req);
    return this.xmlImportService.deleteBatchById(companyId, id);
  }

  @Get('invoices')
  listInvoices(@Req() req: any, @Query('batchId') batchId?: string) {
    const companyId = this.resolveCompanyIdFromUser(req);
    return this.xmlImportService.listInvoices(companyId, batchId);
  }

  @Get('retail-products')
  listRetailProductImports(
    @Req() req: any,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('supplier') supplier?: string,
    @Query('invoiceNumber') invoiceNumber?: string,
    @Query('itemDescription') itemDescription?: string,
  ) {
    const companyId = this.resolveCompanyIdFromUser(req);
    return this.xmlImportService.listRetailProductImports(companyId, {
      dateFrom,
      dateTo,
      supplier,
      invoiceNumber,
      itemDescription,
    });
  }

  @Get('retail-products/:id')
  getRetailProductImportById(@Req() req: any, @Param('id') id: string) {
    const companyId = this.resolveCompanyIdFromUser(req);
    return this.xmlImportService.getRetailProductImportById(companyId, id);
  }

  @Delete('invoices')
  deleteInvoices(@Req() req: any, @Body() dto: DeleteXmlInvoicesDto) {
    const companyId = this.resolveCompanyIdFromUser(req);
    return this.xmlImportService.deleteInvoices(companyId, dto.invoiceIds);
  }

  @Get('invoices/:id')
  getInvoiceById(
    @Req() req: any,
    @Param('id') id: string,
    @Query('includeRawXml') includeRawXml?: string,
  ) {
    const companyId = this.resolveCompanyIdFromUser(req);
    const shouldIncludeRawXml = String(includeRawXml || '').toLowerCase() === 'true';
    return this.xmlImportService.getInvoiceById(companyId, id, shouldIncludeRawXml);
  }

  @Post('invoices/:id/process/fuel')
  processInvoiceAsFuel(@Req() req: any, @Param('id') id: string) {
    const companyId = this.resolveCompanyIdFromUser(req);
    return this.xmlImportService.processInvoiceAsFuel(companyId, id);
  }

  @Post('invoices/:id/process/maintenance')
  processInvoiceAsMaintenance(@Req() req: any, @Param('id') id: string) {
    const companyId = this.resolveCompanyIdFromUser(req);
    return this.xmlImportService.processInvoiceAsMaintenance(companyId, id);
  }

  @Post('invoices/:id/process/cost')
  processInvoiceAsCost(@Req() req: any, @Param('id') id: string) {
    const companyId = this.resolveCompanyIdFromUser(req);
    return this.xmlImportService.processInvoiceAsCost(companyId, id);
  }

  @Post('invoices/:id/process/retail-product')
  processInvoiceAsRetailProduct(@Req() req: any, @Param('id') id: string) {
    const companyId = this.resolveCompanyIdFromUser(req);
    return this.xmlImportService.processInvoiceAsRetailProduct(companyId, id);
  }

  @Post('invoices/:id/ignore')
  ignoreInvoice(@Req() req: any, @Param('id') id: string) {
    const companyId = this.resolveCompanyIdFromUser(req);
    return this.xmlImportService.ignoreInvoice(companyId, id);
  }

  @Patch('invoices/:id/link/fuel')
  completeFuelLink(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: LinkFuelRecordDto,
  ) {
    const companyId = this.resolveCompanyIdFromUser(req);
    return this.xmlImportService.completeFuelLink(companyId, id, dto);
  }

  @Patch('invoices/:id/link/maintenance')
  completeMaintenanceLink(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: LinkMaintenanceRecordDto,
  ) {
    const companyId = this.resolveCompanyIdFromUser(req);
    return this.xmlImportService.completeMaintenanceLink(companyId, id, dto);
  }

  @Patch('invoices/:id/link/cost')
  completeCostLink(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: LinkCostRecordDto,
  ) {
    const companyId = this.resolveCompanyIdFromUser(req);
    return this.xmlImportService.completeCostLink(companyId, id, dto);
  }

  private resolveCompanyIdFromUser(req: any): string {
    const companyId = String(req?.user?.companyId || '').trim();
    if (!companyId) {
      throw new BadRequestException(
        'Usuario autenticado sem companyId para importacao XML.',
      );
    }
    return companyId;
  }
}
