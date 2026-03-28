import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { AllowInadimplenteAccess } from '../auth/allow-inadimplente-access.decorator';
import { Roles } from '../auth/roles.decorator';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @Roles('ADMIN')
  findAll() {
    return this.companiesService.findAll();
  }

  @Get('me')
  @AllowInadimplenteAccess()
  async findCurrent(@Req() req: any) {
    const role = String(req?.user?.role || '').trim().toUpperCase();
    const companyId = String(req?.user?.companyId || '').trim();

    // Superadmin pode operar sem empresa fixa
    if (!companyId && role === 'ADMIN') {
      return null;
    }

    if (!companyId) {
      throw new UnauthorizedException(
        'Usuário autenticado sem companyId. Vincule o usuário a uma empresa.',
      );
    }

    try {
      return await this.companiesService.findOne(companyId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new UnauthorizedException(
          'Empresa não encontrada para usuário autenticado',
        );
      }
      throw error;
    }
  }

  @Get(':id')
  @Roles('ADMIN')
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.companiesService.remove(id);
  }
}
