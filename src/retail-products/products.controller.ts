import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ConfirmProductXmlPreviewDto } from './dto/confirm-product-xml-preview.dto';
import { DeleteRetailProductItemsDto } from './dto/delete-retail-product-items.dto';
import { XmlImportService } from '../xml-import/xml-import.service';

@Controller('products')
export class ProductsController {
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

  @Post('xml/preview')
  @UseInterceptors(FilesInterceptor('files', 20))
  previewXml(
    @UploadedFiles()
    files:
      | Array<{ buffer?: Buffer; originalname?: string; mimetype?: string }>
      | undefined,
    @Req() req: any,
  ) {
    const validFiles = Array.isArray(files)
      ? files.filter((file) => file?.buffer?.length)
      : [];

    if (validFiles.length === 0) {
      throw new BadRequestException(
        'Envie ao menos um arquivo XML valido no campo files.',
      );
    }

    const nonXmlFile = validFiles.find((file) => {
      const fileName = String(file.originalname || '').trim().toLowerCase();
      return !fileName.endsWith('.xml');
    });

    if (nonXmlFile) {
      throw new BadRequestException('Todos os arquivos enviados devem ser XML.');
    }

    return this.xmlImportService.previewProductXmlFiles({
      companyId: this.resolveCompanyIdFromUser(req),
      files: validFiles.map((file) => ({
        buffer: file.buffer as Buffer,
        originalname: file.originalname,
      })),
    });
  }

  @Post('xml/confirm')
  confirmXml(@Body() dto: ConfirmProductXmlPreviewDto, @Req() req: any) {
    return this.xmlImportService.confirmProductXmlPreview(
      this.resolveCompanyIdFromUser(req),
      dto,
    );
  }

  @Delete()
  deleteItems(@Body() dto: DeleteRetailProductItemsDto, @Req() req: any) {
    return this.xmlImportService.deleteRetailProductItems(
      this.resolveCompanyIdFromUser(req),
      dto.itemIds,
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
