import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { FiscalSettingsService } from './fiscal-settings.service';
import { UpsertCompanyFiscalSettingsDto } from './dto/upsert-company-fiscal-settings.dto';

type AuthenticatedRequest = {
  companyScopeId?: string | null;
  user?: {
    userId?: string;
    email?: string;
    role?: string;
    companyId?: string | null;
  };
};

@UseGuards(JwtAuthGuard)
@Controller('fiscal-settings')
export class FiscalSettingsController {
  constructor(private readonly fiscalSettingsService: FiscalSettingsService) {}

  private getCompanyId(req: AuthenticatedRequest) {
    return req?.companyScopeId || req?.user?.companyId || null;
  }

  @Get('me')
  getMine(@Req() req: AuthenticatedRequest) {
    return this.fiscalSettingsService.getByCompany(this.getCompanyId(req));
  }

  @Put('me')
  upsertMine(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpsertCompanyFiscalSettingsDto,
  ) {
    return this.fiscalSettingsService.upsert(this.getCompanyId(req), dto);
  }
}