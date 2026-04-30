import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpsertCompanyFiscalSettingsDto } from "./dto/upsert-company-fiscal-settings.dto";

@Injectable()
export class FiscalSettingsService {
  constructor(private prisma: PrismaService) { }

  async getByCompany(companyId: string) {
    const data = await this.prisma.companyFiscalSettings.findUnique({
      where: { companyId },
    });

    return data ?? {};
  }

  async upsert(companyId: string, dto: UpsertCompanyFiscalSettingsDto) {
    const { certificateExpiresAt, ...rest } = dto;

    return this.prisma.companyFiscalSettings.upsert({
      where: { companyId },

      create: {
        companyId,
        ...rest,
        certificateExpiresAt: certificateExpiresAt
          ? new Date(certificateExpiresAt)
          : undefined,
      },

      update: {
        ...rest,
        certificateExpiresAt: certificateExpiresAt
          ? new Date(certificateExpiresAt)
          : undefined,
      },
    });
  }
}