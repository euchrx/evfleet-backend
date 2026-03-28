import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCompanyDto) {
    const normalizedName = dto.name?.trim();
    const normalizedSlug = dto.slug?.trim();
    const normalizedDocument = dto.document?.trim();

    if (!normalizedName) {
      throw new BadRequestException('Nome da empresa é obrigatório.');
    }

    if (normalizedSlug) {
      await this.ensureSlugAvailable(normalizedSlug);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const createdCompany = await tx.company.create({
          data: {
            name: normalizedName,
            document: normalizedDocument || null,
            slug: normalizedSlug || null,
            active: true,
          },
          select: {
            id: true,
            name: true,
            document: true,
            slug: true,
            active: true,
            createdAt: true,
          },
        });

        await tx.branch.create({
          data: {
            name: normalizedName,
            city: 'Nao informado',
            state: 'NI',
            companyId: createdCompany.id,
          },
        });

        return createdCompany;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('Slug já está em uso.');
      }
      throw error;
    }
  }

  async findAll() {
    return this.prisma.company.findMany({
      orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        document: true,
        slug: true,
        active: true,
        createdAt: true,
      },
    });
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        document: true,
        slug: true,
        active: true,
        createdAt: true,
      },
    });

    if (!company) {
      throw new NotFoundException('Empresa não encontrada.');
    }

    return company;
  }

  async update(id: string, dto: UpdateCompanyDto) {
    await this.findOne(id);

    if (!dto || Object.keys(dto).length === 0) {
      throw new BadRequestException('Envie ao menos um campo para atualizar.');
    }

    const data: {
      name?: string;
      document?: string | null;
      slug?: string | null;
      active?: boolean;
    } = {};

    if (dto.name !== undefined) {
      const normalizedName = dto.name.trim();
      if (!normalizedName) {
        throw new BadRequestException('Nome da empresa é obrigatório.');
      }
      data.name = normalizedName;
    }

    if (dto.document !== undefined) {
      data.document = dto.document.trim() || null;
    }

    if (dto.slug !== undefined) {
      const normalizedSlug = dto.slug.trim();
      if (normalizedSlug) {
        await this.ensureSlugAvailable(normalizedSlug, id);
        data.slug = normalizedSlug;
      } else {
        data.slug = null;
      }
    }

    if (dto.active !== undefined) {
      data.active = dto.active;
    }

    try {
      return await this.prisma.company.update({
        where: { id },
        data,
        select: {
          id: true,
          name: true,
          document: true,
          slug: true,
          active: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('Slug já está em uso.');
      }
      throw error;
    }
  }

  async remove(id: string) {
    await this.findOne(id);

    const dependencySummary = await this.getCompanyDependencySummary(id);
    if (dependencySummary.length > 0) {
      throw new BadRequestException(
        `Não foi possível remover a empresa. Remova os vínculos antes: ${dependencySummary.join(', ')}.`,
      );
    }

    try {
      await this.prisma.company.delete({ where: { id } });
      return { message: 'Empresa removida com sucesso.' };
    } catch {
      throw new BadRequestException(
        'Não foi possível remover a empresa. Verifique vínculos existentes.',
      );
    }
  }

  private async getCompanyDependencySummary(companyId: string) {
    const [branches, users, subscriptions, payments, webhookEvents] =
      await Promise.all([
        this.prisma.branch.count({ where: { companyId } }),
        this.prisma.user.count({ where: { companyId } }),
        this.prisma.subscription.count({ where: { companyId } }),
        this.prisma.payment.count({ where: { companyId } }),
        this.prisma.webhookEvent.count({ where: { companyId } }),
      ]);

    const summary: string[] = [];
    if (branches > 0) summary.push(`${branches} filial(is)`);
    if (users > 0) summary.push(`${users} usuário(s)`);
    if (subscriptions > 0) summary.push(`${subscriptions} assinatura(s)`);
    if (payments > 0) summary.push(`${payments} pagamento(s)`);
    if (webhookEvents > 0) summary.push(`${webhookEvents} evento(s) de webhook`);

    return summary;
  }

  private async ensureSlugAvailable(slug: string, ignoreId?: string) {
    const existingSlug = await this.prisma.company.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existingSlug && existingSlug.id !== ignoreId) {
      throw new BadRequestException('Slug já está em uso.');
    }
  }
}
