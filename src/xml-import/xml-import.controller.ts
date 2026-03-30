import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportXmlZipDto } from './dto/import-xml-zip.dto';
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

  @Get('invoices')
  listInvoices(@Req() req: any, @Query('batchId') batchId?: string) {
    const companyId = this.resolveCompanyIdFromUser(req);
    return this.xmlImportService.listInvoices(companyId, batchId);
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
