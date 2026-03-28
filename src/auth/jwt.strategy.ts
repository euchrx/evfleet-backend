import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET não definido no .env');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    const tokenUserId = String(payload?.userId || payload?.sub || '').trim();
    if (!tokenUserId) {
      throw new UnauthorizedException('Token inválido: userId ausente.');
    }

    const user = await this.usersService.findByIdForAuth(tokenUserId);
    if (!user) {
      throw new UnauthorizedException('Usuário do token não encontrado.');
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };
  }
}
