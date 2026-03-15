import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

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
      if (!existsSync(this.filePath)) return getDefaultMap();
      const raw = readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as { key?: string; visibility?: unknown };
      if (parsed?.key !== MENU_SETTING_KEY) return getDefaultMap();
      return this.normalize(parsed.visibility);
    } catch {
      return getDefaultMap();
    }
  }

  async updateVisibility(visibility: unknown) {
    const normalized = this.normalize(visibility);
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
