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
import { FuelRecordsService } from './fuel-records.service';
import { CreateFuelRecordDto } from './dto/create-fuel-record.dto';
import { UpdateFuelRecordDto } from './dto/update-fuel-record.dto';
import { ConfirmFuelXmlImportDto } from './dto/confirm-fuel-xml-import.dto';
import { ImportXmlZipDto } from '../xml-import/dto/import-xml-zip.dto';
import { LinkFuelRecordDto } from '../xml-import/dto/link-fuel-record.dto';
import { XmlImportService } from '../xml-import/xml-import.service';

@Controller('fuel-records')
export class FuelRecordsController {
  constructor(
    private readonly fuelRecordsService: FuelRecordsService,
    private readonly xmlImportService: XmlImportService,
  ) {}

  @Post()
  create(@Body() dto: CreateFuelRecordDto) {
    return this.fuelRecordsService.create(dto);
  }

  @Get()
  findAll() {
    return this.fuelRecordsService.findAll();
  }

  @Get('insights')
  getInsights() {
    return this.fuelRecordsService.getInsights();
  }

  @Post('import-xml/preview')
  @UseInterceptors(FileInterceptor('file'))
  previewImportXml(
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

    return this.xmlImportService.previewFuelImport({
      companyId: this.resolveCompanyIdFromUser(req),
      branchId: dto.branchId,
      periodLabel: dto.periodLabel,
      fileName: file.originalname || 'importacao.zip',
      zipBuffer: file.buffer,
    });
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
      domain: 'FUEL',
    });
  }

  @Post('import-xml/confirm')
  confirmImportXml(
    @Body() dto: ConfirmFuelXmlImportDto,
    @Req() req: any,
  ) {
    return this.xmlImportService.confirmFuelImport({
      companyId: this.resolveCompanyIdFromUser(req),
      imports: dto.imports,
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
      'FUEL',
      { period, issuerName, number, processingStatus, dateFrom, dateTo },
    );
  }

  @Patch('imported-xml/:id/link/fuel')
  completeImportedFuelLink(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: LinkFuelRecordDto,
  ) {
    return this.xmlImportService.completeFuelLink(
      this.resolveCompanyIdFromUser(req),
      id,
      dto,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.fuelRecordsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFuelRecordDto) {
    return this.fuelRecordsService.update(id, dto);
  }

  @Patch(':id/acknowledge-anomaly')
  acknowledgeAnomaly(@Param('id') id: string) {
    return this.fuelRecordsService.acknowledgeAnomaly(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.fuelRecordsService.remove(id);
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
