import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
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
  findCurrent(@Req() req: any) {
    const companyId = (req?.user?.companyId as string | undefined)?.trim();
    if (!companyId) {
      throw new BadRequestException(
        'Usuário autenticado sem companyId. Vincule o usuário a uma empresa.',
      );
    }
    return this.companiesService.findOne(companyId);
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
