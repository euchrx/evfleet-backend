import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupportRequestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompleteSupportRequestDto } from './dto/complete-support-request.dto';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { RespondSupportRequestDto } from './dto/respond-support-request.dto';

type SupportContext = {
  userId?: string | null;
  role?: string | null;
  companyId?: string | null;
  companyScopeId?: string | null;
};

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async listRequests(context: SupportContext) {
    const isAdmin = this.isAdmin(context.role);
    const companyId = this.resolveCompanyId(context);

    if (!isAdmin && !companyId) {
      throw new BadRequestException('Usuário sem empresa vinculada para suporte.');
    }

    if (!isAdmin) {
      await this.ensureStarterPlan(companyId as string);
    }

    return this.prisma.supportRequest.findMany({
      where: {
        ...(isAdmin
          ? companyId
            ? { companyId }
            : {}
          : { companyId: companyId as string }),
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        status: true,
        responseMessage: true,
        estimatedCompletionAt: true,
        respondedAt: true,
        completionMessage: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        respondedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        completedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async createRequest(context: SupportContext, dto: CreateSupportRequestDto) {
    if (this.isAdmin(context.role)) {
      throw new ForbiddenException('Pedidos de suporte são abertos pelo cliente.');
    }

    const companyId = this.resolveCompanyId(context);
    if (!companyId) {
      throw new BadRequestException('Usuário sem empresa vinculada para suporte.');
    }

    const userId = this.normalizeId(context.userId);
    if (!userId) {
      throw new BadRequestException('Usuário autenticado inválido para abrir suporte.');
    }

    await this.ensureStarterPlan(companyId);

    return this.prisma.supportRequest.create({
      data: {
        title: dto.title.trim(),
        description: dto.description.trim(),
        category: dto.category,
        companyId,
        createdByUserId: userId,
      },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async respondRequest(
    requestId: string,
    context: SupportContext,
    dto: RespondSupportRequestDto,
  ) {
    this.ensureAdmin(context.role);

    const request = await this.prisma.supportRequest.findUnique({
      where: { id: requestId },
      select: { id: true },
    });

    if (!request) {
      throw new NotFoundException('Pedido de suporte não encontrado.');
    }

    return this.prisma.supportRequest.update({
      where: { id: request.id },
      data: {
        status: SupportRequestStatus.IN_PROGRESS,
        responseMessage: dto.responseMessage.trim(),
        estimatedCompletionAt: dto.estimatedCompletionAt
          ? new Date(dto.estimatedCompletionAt)
          : null,
        respondedAt: new Date(),
        respondedByUserId: this.normalizeId(context.userId) || null,
      },
      select: {
        id: true,
        status: true,
        responseMessage: true,
        estimatedCompletionAt: true,
        respondedAt: true,
      },
    });
  }

  async completeRequest(
    requestId: string,
    context: SupportContext,
    dto: CompleteSupportRequestDto,
  ) {
    this.ensureAdmin(context.role);

    const request = await this.prisma.supportRequest.findUnique({
      where: { id: requestId },
      select: { id: true },
    });

    if (!request) {
      throw new NotFoundException('Pedido de suporte não encontrado.');
    }

    return this.prisma.supportRequest.update({
      where: { id: request.id },
      data: {
        status: SupportRequestStatus.COMPLETED,
        completionMessage: String(dto.completionMessage || '').trim() || null,
        completedAt: new Date(),
        completedByUserId: this.normalizeId(context.userId) || null,
      },
      select: {
        id: true,
        status: true,
        completionMessage: true,
        completedAt: true,
        completedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async deleteRequest(requestId: string, context: SupportContext) {
    const request = await this.prisma.supportRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        companyId: true,
        createdByUserId: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Pedido de suporte não encontrado.');
    }

    const isAdmin = this.isAdmin(context.role);
    const userId = this.normalizeId(context.userId);
    const companyId = this.resolveCompanyId(context);

    if (!isAdmin) {
      if (!companyId || companyId !== request.companyId) {
        throw new ForbiddenException('Você não tem permissão para excluir este pedido.');
      }

      if (!userId || userId !== request.createdByUserId) {
        throw new ForbiddenException('Você só pode excluir pedidos criados por você.');
      }

      await this.ensureStarterPlan(companyId);
    }

    await this.prisma.supportRequest.delete({
      where: { id: request.id },
    });

    return {
      success: true,
      message: 'Pedido de suporte excluído com sucesso.',
    };
  }

  private async ensureStarterPlan(companyId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { companyId },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        plan: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    });

    const code = String(subscription?.plan?.code || '').trim().toUpperCase();
    const name = String(subscription?.plan?.name || '').trim().toUpperCase();
    const isStarter =
      code === 'STA' || code === 'STARTER' || name.includes('STARTER');

    if (!isStarter) {
      throw new ForbiddenException(
        'O suporte direto pelo sistema está disponível apenas para empresas no plano Starter.',
      );
    }
  }

  private resolveCompanyId(context: SupportContext) {
    return (
      this.normalizeId(context.companyScopeId) ||
      this.normalizeId(context.companyId) ||
      null
    );
  }

  private ensureAdmin(role?: string | null) {
    if (!this.isAdmin(role)) {
      throw new ForbiddenException(
        'Apenas administradores podem responder pedidos de suporte.',
      );
    }
  }

  private isAdmin(role?: string | null) {
    return String(role || '').trim().toUpperCase() === 'ADMIN';
  }

  private normalizeId(value?: string | null) {
    const normalized = String(value || '').trim();
    return normalized || null;
  }
}
