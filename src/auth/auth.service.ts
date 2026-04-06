import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

const LEGAL_ACCEPTANCE_SETTING_KEY = 'legal_acceptance_settings';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private prisma: PrismaService,
  ) {}

  async login(email: string, password: string, acceptedLegalTerms = false) {
    const user = await this.users.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    await this.ensureCompanyLegalAcceptance(user, acceptedLegalTerms);

    const payload = {
      userId: user.id,
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };

    return {
      access_token: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      },
    };
  }

  async resolveLoginProfile(email: string) {
    const user = await this.users.findByEmail(email);
    const legalAcceptanceEnabled = await this.isLegalAcceptanceEnabled();
    if (!user) {
      return {
        email,
        userExists: false,
        role: null,
        isAdmin: false,
        legalAcceptanceEnabled,
        needsLegalAcceptance: false,
      };
    }

    const normalizedRole = String(user?.role || '').trim().toUpperCase();
    const companyId = String(user?.companyId || '').trim();
    const currentVersion = this.getCurrentLegalAcceptanceVersion();
    let needsLegalAcceptance = false;

    if (legalAcceptanceEnabled && normalizedRole !== 'ADMIN' && companyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: {
          legalAcceptanceVersion: true,
        },
      });

      needsLegalAcceptance =
        company?.legalAcceptanceVersion !== currentVersion;
    }

    return {
      email,
      userExists: true,
      role: normalizedRole || null,
      isAdmin: normalizedRole === 'ADMIN',
      legalAcceptanceEnabled,
      needsLegalAcceptance,
    };
  }

  async reauthenticateAdmin(userId: string, password: string) {
    const normalizedUserId = String(userId || '').trim();
    const normalizedPassword = String(password || '');

    if (!normalizedUserId) {
      throw new UnauthorizedException('Usuário autenticado inválido.');
    }

    const user = await this.users.findAuthCredentialsById(normalizedUserId);
    if (!user) {
      throw new UnauthorizedException('Usuário autenticado não encontrado.');
    }

    if (String(user.role || '').trim().toUpperCase() !== 'ADMIN') {
      throw new ForbiddenException(
        'Acesso negado. Esta ação é permitida apenas para ADMIN.',
      );
    }

    const passwordMatches = await bcrypt.compare(
      normalizedPassword,
      user.password,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Senha do administrador incorreta.');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };
  }

  private async ensureCompanyLegalAcceptance(
    user: {
      id: string;
      name: string;
      role: string;
      companyId?: string | null;
    },
    acceptedLegalTerms: boolean,
  ) {
    if (!(await this.isLegalAcceptanceEnabled())) {
      return;
    }

    if (String(user.role || '').trim().toUpperCase() === 'ADMIN') {
      return;
    }

    const companyId = String(user.companyId || '').trim();
    if (!companyId) {
      return;
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        legalAcceptanceVersion: true,
      },
    });

    if (!company) {
      return;
    }

    const currentVersion = this.getCurrentLegalAcceptanceVersion();
    if (company.legalAcceptanceVersion === currentVersion) {
      return;
    }

    if (!acceptedLegalTerms) {
      throw new ForbiddenException({
        success: false,
        errorCode: 'LEGAL_ACCEPTANCE_REQUIRED',
        message:
          'Para continuar, o responsável da empresa deve aceitar os termos de uso e a política de privacidade vigentes.',
        data: {
          currentVersion,
        },
      });
    }

    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        legalAcceptanceVersion: currentVersion,
        legalAcceptedAt: new Date(),
        legalAcceptedByUserId: user.id,
        legalAcceptedByUserName: user.name,
      },
    });
  }

  private getCurrentLegalAcceptanceVersion() {
    return process.env.LEGAL_ACCEPTANCE_VERSION?.trim() || '2026-04-06';
  }

  private async isLegalAcceptanceEnabled() {
    try {
      const record = await this.prisma.systemSetting.findUnique({
        where: { key: LEGAL_ACCEPTANCE_SETTING_KEY },
        select: { value: true },
      });

      if (!record?.value || typeof record.value !== 'object') {
        return false;
      }

      return (record.value as { enabled?: unknown }).enabled === true;
    } catch {
      return false;
    }
  }
}
