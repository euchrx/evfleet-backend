import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Controller('branches')
export class BranchesController {
  constructor(private readonly service: BranchesService) {}

  @Post()
  create(@Body() dto: CreateBranchDto, @Req() req: any) {
    const companyId =
      dto.companyId || req?.companyScopeId || req?.user?.companyId;
    return this.service.create({
      ...dto,
      companyId,
    });
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
