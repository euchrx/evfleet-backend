import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BillingLifecycleService } from '../billing/billing-lifecycle.service';
import { BillingAccessService } from '../billing/billing-access.service';
import { IS_PUBLIC_KEY } from 'src/auth/public.decorator';
import { ALLOW_INADIMPLENTE_ACCESS_KEY } from 'src/auth/allow-inadimplente-access.decorator';
import { ALLOW_NO_PLAN_ACCESS_KEY } from 'src/auth/allow-no-plan-access.decorator';

@Injectable()
export class SubscriptionAccessGuard implements CanActivate {
  private readonly logger = new Logger(SubscriptionAccessGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly billingLifecycleService: BillingLifecycleService,
    private readonly billingAccessService: BillingAccessService,
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

    const allowNoPlanAccess = this.reflector.getAllAndOverride<boolean>(
      ALLOW_NO_PLAN_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );

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
    const user = request?.user as
      | { userId?: string; companyId?: string }
      | undefined;

    if (!user?.userId) return true;
    if (!user.companyId) return true;

    const access = await this.billingAccessService.getCompanyAccessStatus(
      user.companyId,
    );

    if (access.accessStatus === 'NO_PLAN') {
      if (allowNoPlanAccess) return true;

      throw new ForbiddenException(
        'Empresa sem plano configurado. Finalize a configuração comercial para liberar o uso do sistema.',
      );
    }

    if (access.isBlocked) {
      if (allowInadimplenteAccess) return true;

      throw new ForbiddenException(
        'Acesso bloqueado por inadimplência. Regularize sua assinatura para continuar.',
      );
    }

    return true;
  }
}