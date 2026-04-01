import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) throw new BadRequestException('Email já cadastrado');

    const passwordHash = await bcrypt.hash(data.password, 10);
    const companyId = await this.resolveCompanyId(data.role, data.companyId);

    return this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: passwordHash,
        role: data.role,
        companyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        companyId: true,
      },
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        companyId: true,
      },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        companyId: true,
      },
    });

    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);

    if (!dto || Object.keys(dto).length === 0) {
      throw new BadRequestException('Envie ao menos um campo para atualizar.');
    }

    if (dto.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
        select: { id: true },
      });

      if (existing && existing.id !== id) {
        throw new BadRequestException('Email já cadastrado');
      }
    }

    const data: {
      name?: string;
      email?: string;
      password?: string;
      role?: UpdateUserDto['role'];
    } = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.password !== undefined) {
      data.password = await bcrypt.hash(dto.password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        companyId: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.user.delete({ where: { id } });
    return { message: 'Usuário removido com sucesso' };
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findByIdForAuth(id: string) {
    const userId = String(id || '').trim();
    if (!userId) return null;

    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        companyId: true,
      },
    });
  }

  async findAuthCredentialsById(id: string) {
    const userId = String(id || '').trim();
    if (!userId) return null;

    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        companyId: true,
      },
    });
  }

  async findMe(id: string) {
    const authUser = await this.findByIdForAuth(id);
    if (!authUser) {
      throw new UnauthorizedException('Usuário autenticado não encontrado.');
    }

    return this.prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        companyId: true,
      },
    });
  }

  private async resolveCompanyId(
    role: CreateUserDto['role'],
    inputCompanyId?: string,
  ) {
    const companyId = String(inputCompanyId || '').trim();
    if (!companyId) {
      if (role === 'ADMIN') {
        return null;
      }

      throw new BadRequestException(
        'Selecione uma empresa para criar usuários gestores.',
      );
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) {
      throw new BadRequestException('Empresa não encontrada.');
    }
    return company.id;
  }
}
