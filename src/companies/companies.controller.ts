import { Body, Controller, Post } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }
}
