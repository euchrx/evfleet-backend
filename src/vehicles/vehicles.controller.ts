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
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { Roles } from '../auth/roles.decorator';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

type UploadKind = 'photo' | 'document';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly service: VehiclesService) {}

  @Roles('ADMIN', 'FLEET_MANAGER')
  @Post('upload/:kind')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const rawKind = String(req.params.kind || 'photo');
          const kind: UploadKind = rawKind === 'document' ? 'document' : 'photo';
          const uploadPath = join(
            process.cwd(),
            'uploads',
            'vehicles',
            kind === 'photo' ? 'photos' : 'documents',
          );

          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }

          cb(null, uploadPath);
        },
        filename: (_, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          const extension = extname(file.originalname || '');
          cb(null, `${uniqueSuffix}${extension}`);
        },
      }),
      fileFilter: (_, file, cb) => {
        const allowed = /\.(jpg|jpeg|png|webp|pdf|doc|docx)$/i.test(file.originalname || '');
        if (!allowed) return cb(new BadRequestException('Formato de arquivo nao suportado'), false);
        cb(null, true);
      },
    }),
  )
  uploadFiles(@Param('kind') kind: string, @UploadedFiles() files: any[]) {
    const normalizedKind: UploadKind | null =
      kind === 'document' ? 'document' : kind === 'photo' ? 'photo' : null;
    if (!normalizedKind) throw new BadRequestException('Tipo de upload invalido');
    if (!files?.length) throw new BadRequestException('Nenhum arquivo enviado');

    const urls = files.map((file) => {
      const folder = normalizedKind === 'photo' ? 'photos' : 'documents';
      return `/uploads/vehicles/${folder}/${file.filename}`;
    });

    return { urls };
  }

  @Roles('ADMIN', 'FLEET_MANAGER')
  @Post()
  create(@Body() dto: CreateVehicleDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(
    @Query('branchId') branchId?: string,
    @Query('vehicleType') vehicleType?: 'LIGHT' | 'HEAVY',
    @Query('plate') plate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      branchId,
      vehicleType,
      plate,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/history')
  getHistory(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getHistory(
      id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
    );
  }

  @Roles('ADMIN', 'FLEET_MANAGER')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVehicleDto) {
    return this.service.update(id, dto);
  }

  @Roles('ADMIN', 'FLEET_MANAGER')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
