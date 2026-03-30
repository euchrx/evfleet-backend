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
import { MaintenanceRecordsService } from './maintenance-records.service';
import { CreateMaintenanceRecordDto } from './dto/create-maintenance-record.dto';
import { UpdateMaintenanceRecordDto } from './dto/update-maintenance-record.dto';
import { ImportXmlZipDto } from '../xml-import/dto/import-xml-zip.dto';
import { XmlImportService } from '../xml-import/xml-import.service';

@Controller('maintenance-records')
export class MaintenanceRecordsController {
  constructor(
    private readonly maintenanceRecordsService: MaintenanceRecordsService,
    private readonly xmlImportService: XmlImportService,
  ) {}

  @Post()
  create(@Body() dto: CreateMaintenanceRecordDto) {
    return this.maintenanceRecordsService.create(dto);
  }

  @Get()
  findAll() {
    return this.maintenanceRecordsService.findAll();
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
      domain: 'MAINTENANCE',
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
      'MAINTENANCE',
      { period, issuerName, number, processingStatus, dateFrom, dateTo },
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.maintenanceRecordsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMaintenanceRecordDto) {
    return this.maintenanceRecordsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.maintenanceRecordsService.remove(id);
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
