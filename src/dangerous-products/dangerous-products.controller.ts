import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  BadRequestException,
} from "@nestjs/common";
import { DangerousProductsService } from "./dangerous-products.service";
import { CreateDangerousProductDto } from "./dto/create-dangerous-product.dto";
import { UpdateDangerousProductDto } from "./dto/update-dangerous-product.dto";

@Controller("dangerous-products")
export class DangerousProductsController {
  constructor(private readonly service: DangerousProductsService) {}

  private getCompanyId(req: any): string {
    const companyId = req.headers["x-company-scope"];

    if (!companyId) {
      throw new BadRequestException("Empresa não selecionada");
    }

    return companyId;
  }

  @Get()
  async findAll(@Req() req: any) {
    const companyId = this.getCompanyId(req);
    return this.service.findAll(companyId);
  }

  @Get("active")
  async findActive(@Req() req: any) {
    const companyId = this.getCompanyId(req);
    return this.service.findActive(companyId);
  }

  @Get(":id")
  async findOne(@Param("id") id: string, @Req() req: any) {
    const companyId = this.getCompanyId(req);
    return this.service.findOne(id, companyId);
  }

  @Post()
  async create(
    @Req() req: any,
    @Body() dto: CreateDangerousProductDto,
  ) {
    const companyId = this.getCompanyId(req);
    return this.service.create(companyId, dto);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Req() req: any,
    @Body() dto: UpdateDangerousProductDto,
  ) {
    const companyId = this.getCompanyId(req);
    return this.service.update(id, companyId, dto);
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @Req() req: any) {
    const companyId = this.getCompanyId(req);
    return this.service.remove(id, companyId);
  }
}