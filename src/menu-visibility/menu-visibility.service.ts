import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';

const MENU_SETTING_KEY = 'menu_visibility';

const MENU_PATHS = [
  '/dashboard',
  '/reports',
  '/vehicles',
  '/drivers',
  '/maintenance-records',
  '/fuel-records',
  '/debts',
  '/trips',
  '/vehicle-documents',
  '/branches',
  '/how-to-use',
  '/users',
  '/administration',
] as const;

type MenuVisibilityMap = Record<string, boolean>;

function getDefaultMap(): MenuVisibilityMap {
  return MENU_PATHS.reduce<MenuVisibilityMap>((acc, path) => {
    acc[path] = true;
    return acc;
  }, {});
}

@Injectable()
export class MenuVisibilityService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly filePath = join(process.cwd(), 'uploads', 'menu-visibility.json');

  private normalize(input: unknown): MenuVisibilityMap {
    const defaults = getDefaultMap();
    if (!input || typeof input !== 'object') return defaults;

    const raw = input as Record<string, unknown>;
    const next: MenuVisibilityMap = { ...defaults };
    for (const path of MENU_PATHS) {
      if (typeof raw[path] === 'boolean') {
        next[path] = raw[path] as boolean;
      }
    }

    // Evita lock do sistema: administração sempre visível para admin reverter.
    next['/administration'] = true;
    return next;
  }

  async getVisibility() {
    try {
      const record = await this.prisma.systemSetting.findUnique({
        where: { key: MENU_SETTING_KEY },
      });

      if (record?.value) {
        return this.normalize(record.value);
      }

      // Migração automática: se houver arquivo legado, promove para banco.
      const legacy = this.readLegacyFile();
      if (legacy) {
        await this.prisma.systemSetting.upsert({
          where: { key: MENU_SETTING_KEY },
          update: { value: legacy },
          create: {
            key: MENU_SETTING_KEY,
            value: legacy,
          },
        });
        return legacy;
      }
    } catch {
      // fallback silencioso para legado
    }

    // Último fallback para ambientes sem tabela migrada
    const legacy = this.readLegacyFile();
    if (legacy) return legacy;

    return getDefaultMap();
  }

  private readLegacyFile() {
    try {
      if (!existsSync(this.filePath)) return null;
      const raw = readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as { key?: string; visibility?: unknown };
      if (parsed?.key !== MENU_SETTING_KEY) return null;
      return this.normalize(parsed.visibility);
    } catch {
      return null;
    }
  }

  async updateVisibility(visibility: unknown) {
    const normalized = this.normalize(visibility);
    try {
      await this.prisma.systemSetting.upsert({
        where: { key: MENU_SETTING_KEY },
        update: { value: normalized },
        create: {
          key: MENU_SETTING_KEY,
          value: normalized,
        },
      });
      return normalized;
    } catch {
      // Fallback legado para ambientes sem migration aplicada
      const dirPath = join(process.cwd(), 'uploads');
      if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
      }
      writeFileSync(
        this.filePath,
        JSON.stringify({ key: MENU_SETTING_KEY, visibility: normalized }, null, 2),
        'utf8',
      );
      return normalized;
    }
  }
}
