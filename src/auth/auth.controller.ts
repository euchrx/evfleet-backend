import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { AllowInadimplenteAccess } from './allow-inadimplente-access.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from './public.decorator';

@Controller(['auth', 'api/auth'])
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @AllowInadimplenteAccess()
  @Get('me')
  async me(@Req() req: any) {
    console.log('req.user:', req?.user);

    const userId = String(req?.user?.userId || '').trim();
    if (!userId) {
      throw new UnauthorizedException('Token inválido: userId ausente.');
    }

    const user = await this.users.findMe(userId);
    if (!user) {
      throw new UnauthorizedException('Usuário autenticado não encontrado.');
    }
    return user;
  }
}
