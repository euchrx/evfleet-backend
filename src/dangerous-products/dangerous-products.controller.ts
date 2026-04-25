import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { DangerousProductsService } from './dangerous-products.service';
import { CreateDangerousProductDto } from './dto/create-dangerous-product.dto';
import { UpdateDangerousProductDto } from './dto/update-dangerous-product.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

type RequestWithUser = Request & {
  user?: {
    userId?: string;
    sub?: string;
    email?: string;
    role?: string;
    companyId?: string | null;
  };
};

@Controller('dangerous-products')
@UseGuards(JwtAuthGuard)
export class DangerousProductsController {
  constructor(
    private readonly dangerousProductsService: DangerousProductsService,
  ) {}

  private getCompanyId(req: RequestWithUser): string {
    const companyId = req.user?.companyId;

    if (!companyId) {
      throw new ForbiddenException('Empresa não identificada no token.');
    }

    return companyId;
  }

  @Post()
  create(@Req() req: RequestWithUser, @Body() dto: CreateDangerousProductDto) {
    return this.dangerousProductsService.create(
      { companyId: this.getCompanyId(req) },
      dto,
    );
  }

  @Get()
  findAll(@Req() req: RequestWithUser) {
    return this.dangerousProductsService.findAll({
      companyId: this.getCompanyId(req),
    });
  }

  @Get('active')
  findActive(@Req() req: RequestWithUser) {
    return this.dangerousProductsService.findActive({
      companyId: this.getCompanyId(req),
    });
  }

  @Get(':id')
  findOne(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.dangerousProductsService.findOne(
      { companyId: this.getCompanyId(req) },
      id,
    );
  }

  @Patch(':id')
  update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateDangerousProductDto,
  ) {
    return this.dangerousProductsService.update(
      { companyId: this.getCompanyId(req) },
      id,
      dto,
    );
  }

  @Delete(':id')
  remove(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.dangerousProductsService.remove(
      { companyId: this.getCompanyId(req) },
      id,
    );
  }
}