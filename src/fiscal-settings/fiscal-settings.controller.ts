import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  BadRequestException,
} from "@nestjs/common";
import { FiscalSettingsService } from "./fiscal-settings.service";
import { UpsertCompanyFiscalSettingsDto } from "./dto/upsert-company-fiscal-settings.dto";

@Controller("fiscal-settings")
export class FiscalSettingsController {
  constructor(private service: FiscalSettingsService) {}

  private getCompanyId(req: any): string {
    const companyId =
      req.headers["x-company-scope"] || req.headers["X-Company-Scope"];

    if (!companyId) {
      throw new BadRequestException("Empresa não selecionada");
    }

    return companyId;
  }

  @Get("me")
  async get(@Req() req: any) {
    const companyId = this.getCompanyId(req);
    return this.service.getByCompany(companyId);
  }

  @Put("me")
  async update(
    @Req() req: any,
    @Body() dto: UpsertCompanyFiscalSettingsDto,
  ) {
    const companyId = this.getCompanyId(req);
    return this.service.upsert(companyId, dto);
  }
}