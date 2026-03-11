import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { DebtsService } from './debts.service';
import { CreateDebtDto } from './dto/create-debt.dto';
import { UpdateDebtDto } from './dto/update-debt.dto';

@Controller('debts')
export class DebtsController {
  constructor(private readonly debtsService: DebtsService) {}

  @Post()
  create(@Body() dto: CreateDebtDto) {
    return this.debtsService.create(dto);
  }

  @Get()
  findAll() {
    return this.debtsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.debtsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDebtDto) {
    return this.debtsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.debtsService.remove(id);
  }
}
