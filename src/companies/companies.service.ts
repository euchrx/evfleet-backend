import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyDeletionService } from './company-deletion.service';
import {
  CompanyDeletionErrorBody,
  DeleteAuthorizationResponse,
} from './company-deletion.types';
import { CreateCompanyDto } from './dto/create-company.dto';
import { DeleteCompanyDto } from './dto/delete-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  private static readonly DELETE_CONFIRMATION_TEXT = 'EXCLUIR EMPRESA';

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly companyDeletionService: CompanyDeletionService,
  ) {}

  private readonly TRIAL_DAYS = 15;

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
        const defaultPlan = await tx.plan.findFirst({
          where: { isActive: true },
          orderBy: [{ priceCents: 'asc' }, { createdAt: 'asc' }],
          select: { id: true },
        });

        if (!defaultPlan) {
          throw new BadRequestException(
            'Nenhum plano ativo encontrado. Cadastre e ative ao menos um plano antes de criar empresa.',
          );
        }

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

        const now = new Date();
        const trialEndsAt = this.addDays(now, this.TRIAL_DAYS);
        await tx.subscription.create({
          data: {
            companyId: createdCompany.id,
            planId: defaultPlan.id,
            status: SubscriptionStatus.TRIALING,
            startedAt: now,
            trialEndsAt,
            currentPeriodStart: now,
            currentPeriodEnd: trialEndsAt,
            nextBillingAt: trialEndsAt,
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

  async validateDeleteAuthorization(
    companyId: string,
    dto: DeleteCompanyDto,
    authenticatedUser: any,
  ): Promise<DeleteAuthorizationResponse> {
    const authenticatedUserId = String(
      authenticatedUser?.userId || authenticatedUser?.id || '',
    ).trim();
    if (!authenticatedUserId) {
      throw this.buildUnauthorizedException(
        'COMPANY_DELETE_AUTHENTICATED_USER_INVALID',
        'Não foi possível validar o usuário autenticado para esta ação.',
      );
    }

    const company = await this.findCompanyForDeletion(companyId);
    this.validateConfirmationText(dto.confirmationText);

    try {
      await this.authService.reauthenticateAdmin(
        authenticatedUserId,
        dto.password,
      );
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw this.buildUnauthorizedException(
          'COMPANY_DELETE_INVALID_PASSWORD',
          'A senha informada está incorreta. Confirme a senha atual do administrador.',
        );
      }

      throw error;
    }

    return {
      success: true,
      message: 'Reautenticação confirmada para exclusão definitiva da empresa.',
      data: {
        company: {
          id: company.id,
          name: company.name,
          slug: company.slug,
        },
        confirmationText: dto.confirmationText,
      },
    };
  }

  async deleteWithBackup(
    companyId: string,
    dto: DeleteCompanyDto,
    authenticatedUser: any,
  ) {
    const validated = await this.validateDeleteAuthorization(
      companyId,
      dto,
      authenticatedUser,
    );

    return this.companyDeletionService.deleteWithBackup(
      validated.data.company,
      authenticatedUser,
    );
  }

  private async findCompanyForDeletion(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    if (!company) {
      throw this.buildNotFoundException(
        'COMPANY_NOT_FOUND',
        'A empresa informada não foi encontrada para exclusão.',
      );
    }

    return company;
  }

  private validateConfirmationText(confirmationText: string) {
    if (confirmationText !== CompaniesService.DELETE_CONFIRMATION_TEXT) {
      throw this.buildBadRequestException(
        'COMPANY_DELETE_CONFIRMATION_TEXT_INVALID',
        `Texto de confirmação inválido. Digite exatamente: ${CompaniesService.DELETE_CONFIRMATION_TEXT}.`,
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

  private addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private buildBadRequestException(errorCode: string, message: string) {
    return new BadRequestException(this.buildErrorBody(errorCode, message));
  }

  private buildUnauthorizedException(errorCode: string, message: string) {
    return new UnauthorizedException(this.buildErrorBody(errorCode, message));
  }

  private buildNotFoundException(errorCode: string, message: string) {
    return new NotFoundException(this.buildErrorBody(errorCode, message));
  }

  private buildErrorBody(
    errorCode: string,
    message: string,
  ): CompanyDeletionErrorBody {
    return {
      success: false,
      errorCode,
      message,
    };
  }
}
