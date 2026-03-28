import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateBranchDto) {
    const companyId = await this.resolveCompanyId(data.companyId);
    return this.prisma.branch.create({
      data: {
        name: data.name,
        city: data.city,
        state: data.state,
        companyId,
      },
    });
  }

  async findAll() {
    return this.prisma.branch.findMany();
  }

  async findOne(id: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id } });
    if (!branch) throw new NotFoundException('Filial nao encontrada');
    return branch;
  }

  async update(id: string, dto: UpdateBranchDto) {
    await this.findOne(id);

    if (!dto || Object.keys(dto).length === 0) {
      throw new BadRequestException('Envie ao menos um campo para atualizar.');
    }

    return this.prisma.branch.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.state !== undefined ? { state: dto.state } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    try {
      await this.prisma.branch.delete({ where: { id } });
      return { message: 'Filial removida com sucesso' };
    } catch {
      throw new BadRequestException(
        'Nao foi possivel excluir a filial. Verifique vinculos existentes.',
      );
    }
  }

  private async resolveCompanyId(inputCompanyId?: string) {
    const companyId = String(inputCompanyId || '').trim();
    if (!companyId) {
      throw new BadRequestException(
        'companyId obrigatorio para criar filial no modo multiempresa.',
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
