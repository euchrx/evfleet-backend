import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  async create(data: { name: string; city: string; state: string }) {
    return this.prisma.branch.create({
      data,
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
}
