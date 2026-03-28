import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BillingLifecycleService } from '../billing/billing-lifecycle.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ALLOW_INADIMPLENTE_ACCESS_KEY } from './allow-inadimplente-access.decorator';

@Injectable()
export class SubscriptionAccessGuard implements CanActivate {
  private readonly logger = new Logger(SubscriptionAccessGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly billingLifecycleService: BillingLifecycleService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const allowInadimplenteAccess = this.reflector.getAllAndOverride<boolean>(
      ALLOW_INADIMPLENTE_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowInadimplenteAccess) return true;

    // Mantém a assinatura atualizada mesmo sem scheduler.
    // Em caso de falha, apenas registra log e segue para não quebrar autenticação.
    try {
      await this.billingLifecycleService.processOverduePaymentsIfNeeded();
    } catch (error) {
      this.logger.warn(
        `Falha ao processar vencimentos de billing: ${
          error instanceof Error ? error.message : 'erro desconhecido'
        }`,
      );
    }

    const request = context.switchToHttp().getRequest();
    const user = request?.user as { userId?: string; companyId?: string } | undefined;
    if (!user?.userId) return true;
    if (!user.companyId) return true;

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        companyId: user.companyId,
        status: {
          in: [
            SubscriptionStatus.TRIALING,
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.PAST_DUE,
            SubscriptionStatus.CANCELED,
          ],
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: { status: true },
    });

    if (!subscription) return true;

    if (
      subscription.status === SubscriptionStatus.PAST_DUE ||
      subscription.status === SubscriptionStatus.CANCELED
    ) {
      throw new ForbiddenException(
        'Acesso bloqueado por inadimplência. Regularize sua assinatura para continuar.',
      );
    }

    return true;
  }
}
