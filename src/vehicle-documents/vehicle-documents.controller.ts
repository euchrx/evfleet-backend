import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { VehicleDocumentsService } from './vehicle-documents.service';
import { CreateVehicleDocumentDto } from './dto/create-vehicle-document.dto';
import { UpdateVehicleDocumentDto } from './dto/update-vehicle-document.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';

@Controller('vehicle-documents')
export class VehicleDocumentsController {
  constructor(private readonly vehicleDocumentsService: VehicleDocumentsService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const uploadDir = join(process.cwd(), 'uploads', 'documents');
          if (!existsSync(uploadDir)) {
            mkdirSync(uploadDir, { recursive: true });
          }
          cb(null, uploadDir);
        },
        filename: (_req, file, cb) => {
          const fileExt = extname(file.originalname);
          const baseName = file.originalname
            .replace(fileExt, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')
            .slice(0, 80);
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${baseName || 'documento'}-${unique}${fileExt.toLowerCase()}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const allowed = [
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/webp',
        ];
        if (!allowed.includes(file.mimetype)) {
          cb(new BadRequestException('Formato de arquivo nao suportado.'), false);
          return;
        }
        cb(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  upload(@UploadedFile() file?: any) {
    if (!file) {
      throw new BadRequestException('Selecione um arquivo para anexar.');
    }

    return {
      fileUrl: `/uploads/documents/${file.filename}`,
      fileName: file.originalname,
    };
  }

  @Post()
  create(@Body() dto: CreateVehicleDocumentDto) {
    return this.vehicleDocumentsService.create(dto);
  }

  @Get()
  findAll() {
    return this.vehicleDocumentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vehicleDocumentsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVehicleDocumentDto) {
    return this.vehicleDocumentsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.vehicleDocumentsService.remove(id);
  }
}
