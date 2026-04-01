import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(private users: UsersService, private jwt: JwtService) {}

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

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
}
