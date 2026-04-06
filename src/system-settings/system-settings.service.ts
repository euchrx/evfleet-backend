import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const LEGAL_ACCEPTANCE_SETTING_KEY = 'legal_acceptance_settings';

@Injectable()
export class SystemSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getLegalAcceptanceSettings() {
    try {
      const record = await this.prisma.systemSetting.findUnique({
        where: { key: LEGAL_ACCEPTANCE_SETTING_KEY },
      });

      return {
        enabled: this.normalizeEnabled(record?.value),
      };
    } catch {
      return { enabled: false };
    }
  }

  async updateLegalAcceptanceSettings(enabled: boolean) {
    const normalized = Boolean(enabled);

    await this.prisma.systemSetting.upsert({
      where: { key: LEGAL_ACCEPTANCE_SETTING_KEY },
      update: {
        value: { enabled: normalized },
      },
      create: {
        key: LEGAL_ACCEPTANCE_SETTING_KEY,
        value: { enabled: normalized },
      },
    });

    return {
      enabled: normalized,
    };
  }

  private normalizeEnabled(value: unknown) {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const raw = value as { enabled?: unknown };
    return raw.enabled === true;
  }
}
