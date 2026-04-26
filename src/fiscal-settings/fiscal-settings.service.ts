import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpsertCompanyFiscalSettingsDto } from './dto/upsert-company-fiscal-settings.dto';

@Injectable()
export class FiscalSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureCompanyId(companyId?: string | null): string {
    if (!companyId) {
      throw new BadRequestException(
        'Usuário sem empresa vinculada. Não é possível acessar configurações fiscais.',
      );
    }

    return companyId;
  }

  async getByCompany(companyId?: string | null) {
    const safeCompanyId = this.ensureCompanyId(companyId);

    const settings = await this.prisma.companyFiscalSettings.findUnique({
      where: { companyId: safeCompanyId },
    });

    if (!settings) {
      throw new NotFoundException('Configuração fiscal não encontrada.');
    }

    return settings;
  }

  async upsert(companyId: string | null | undefined, dto: UpsertCompanyFiscalSettingsDto) {
    const safeCompanyId = this.ensureCompanyId(companyId);

    const company = await this.prisma.company.findUnique({
      where: { id: safeCompanyId },
      select: { id: true },
    });

    if (!company) {
      throw new NotFoundException('Empresa não encontrada.');
    }

    return this.prisma.companyFiscalSettings.upsert({
      where: { companyId: safeCompanyId },
      create: {
        companyId: safeCompanyId,
        ...dto,
        certificateExpiresAt: dto.certificateExpiresAt
          ? new Date(dto.certificateExpiresAt)
          : undefined,
      },
      update: {
        ...dto,
        certificateExpiresAt: dto.certificateExpiresAt
          ? new Date(dto.certificateExpiresAt)
          : null,
      },
    });
  }
}