import { Injectable } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type BillingAccessStatus =
  | 'NO_PLAN'
  | 'SETUP_REQUIRED'
  | 'TRIALING'
  | 'ACTIVE'
  | 'GRACE_PERIOD'
  | 'BLOCKED';

export type BillingAccessResult = {
  companyId: string;
  subscriptionId: string | null;
  subscriptionStatus: SubscriptionStatus | null;
  accessStatus: BillingAccessStatus;
  isBlocked: boolean;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  nextBillingAt: Date | null;
  graceEndsAt: Date | null;
  accessBlockedAt: Date | null;
  message: string;
};

@Injectable()
export class BillingAccessService {
  private static readonly DEFAULT_GRACE_DAYS = 5;

  constructor(private readonly prisma: PrismaService) {}

  async getCompanyAccessStatus(
    companyId: string,
  ): Promise<BillingAccessResult> {
    const normalizedCompanyId = String(companyId || '').trim();

    if (!normalizedCompanyId) {
      return {
        companyId: '',
        subscriptionId: null,
        subscriptionStatus: null,
        accessStatus: 'NO_PLAN',
        isBlocked: false,
        trialEndsAt: null,
        currentPeriodEnd: null,
        nextBillingAt: null,
        graceEndsAt: null,
        accessBlockedAt: null,
        message: 'Empresa sem plano configurado.',
      };
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        companyId: normalizedCompanyId,
        status: {
          in: [
            SubscriptionStatus.DRAFT,
            SubscriptionStatus.TRIALING,
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.PAST_DUE,
            SubscriptionStatus.CANCELED,
          ],
        },
      },
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        status: true,
        trialEndsAt: true,
        currentPeriodEnd: true,
        nextBillingAt: true,
        graceDays: true,
        graceEndsAt: true,
        accessBlockedAt: true,
      },
    });

    if (!subscription) {
      return {
        companyId: normalizedCompanyId,
        subscriptionId: null,
        subscriptionStatus: null,
        accessStatus: 'NO_PLAN',
        isBlocked: false,
        trialEndsAt: null,
        currentPeriodEnd: null,
        nextBillingAt: null,
        graceEndsAt: null,
        accessBlockedAt: null,
        message: 'Empresa sem plano configurado.',
      };
    }

    const now = new Date();

    if (subscription.status === SubscriptionStatus.DRAFT) {
      return {
        companyId: normalizedCompanyId,
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        accessStatus: 'SETUP_REQUIRED',
        isBlocked: false,
        trialEndsAt: subscription.trialEndsAt,
        currentPeriodEnd: subscription.currentPeriodEnd,
        nextBillingAt: subscription.nextBillingAt,
        graceEndsAt: subscription.graceEndsAt,
        accessBlockedAt: subscription.accessBlockedAt,
        message: 'Assinatura em configuração pendente.',
      };
    }

    if (subscription.status === SubscriptionStatus.ACTIVE) {
      return {
        companyId: normalizedCompanyId,
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        accessStatus: 'ACTIVE',
        isBlocked: false,
        trialEndsAt: subscription.trialEndsAt,
        currentPeriodEnd: subscription.currentPeriodEnd,
        nextBillingAt: subscription.nextBillingAt,
        graceEndsAt: subscription.graceEndsAt,
        accessBlockedAt: subscription.accessBlockedAt,
        message: 'Plano ativo e liberado para uso.',
      };
    }

    if (subscription.status === SubscriptionStatus.TRIALING) {
      const trialEndsAt = subscription.trialEndsAt;
      const trialStillActive = !trialEndsAt || trialEndsAt >= now;

      if (trialStillActive) {
        return {
          companyId: normalizedCompanyId,
          subscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          accessStatus: 'TRIALING',
          isBlocked: false,
          trialEndsAt,
          currentPeriodEnd: subscription.currentPeriodEnd,
          nextBillingAt: subscription.nextBillingAt,
          graceEndsAt: subscription.graceEndsAt,
          accessBlockedAt: subscription.accessBlockedAt,
          message: 'Empresa em período de teste.',
        };
      }

      const graceEndsAt =
        subscription.graceEndsAt ??
        this.resolveGraceEndsAt(
          subscription.currentPeriodEnd ?? trialEndsAt,
          subscription.graceDays,
        );

      if (graceEndsAt && now <= graceEndsAt) {
        return {
          companyId: normalizedCompanyId,
          subscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          accessStatus: 'GRACE_PERIOD',
          isBlocked: false,
          trialEndsAt,
          currentPeriodEnd: subscription.currentPeriodEnd,
          nextBillingAt: subscription.nextBillingAt,
          graceEndsAt,
          accessBlockedAt: subscription.accessBlockedAt,
          message:
            'Período de teste vencido. Empresa em prazo de regularização.',
        };
      }

      return {
        companyId: normalizedCompanyId,
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        accessStatus: 'BLOCKED',
        isBlocked: true,
        trialEndsAt,
        currentPeriodEnd: subscription.currentPeriodEnd,
        nextBillingAt: subscription.nextBillingAt,
        graceEndsAt,
        accessBlockedAt: subscription.accessBlockedAt ?? now,
        message:
          'Período de teste vencido e prazo de regularização encerrado.',
      };
    }

    if (subscription.status === SubscriptionStatus.PAST_DUE) {
      const graceEndsAt =
        subscription.graceEndsAt ??
        this.resolveGraceEndsAt(
          subscription.currentPeriodEnd ?? subscription.nextBillingAt,
          subscription.graceDays,
        );

      if (graceEndsAt && now <= graceEndsAt) {
        return {
          companyId: normalizedCompanyId,
          subscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          accessStatus: 'GRACE_PERIOD',
          isBlocked: false,
          trialEndsAt: subscription.trialEndsAt,
          currentPeriodEnd: subscription.currentPeriodEnd,
          nextBillingAt: subscription.nextBillingAt,
          graceEndsAt,
          accessBlockedAt: subscription.accessBlockedAt,
          message:
            'Assinatura vencida. Empresa em prazo de regularização.',
        };
      }

      return {
        companyId: normalizedCompanyId,
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        accessStatus: 'BLOCKED',
        isBlocked: true,
        trialEndsAt: subscription.trialEndsAt,
        currentPeriodEnd: subscription.currentPeriodEnd,
        nextBillingAt: subscription.nextBillingAt,
        graceEndsAt,
        accessBlockedAt: subscription.accessBlockedAt ?? now,
        message:
          'Assinatura vencida e prazo de regularização encerrado.',
      };
    }

    return {
      companyId: normalizedCompanyId,
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      accessStatus: 'BLOCKED',
      isBlocked: true,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodEnd: subscription.currentPeriodEnd,
      nextBillingAt: subscription.nextBillingAt,
      graceEndsAt: subscription.graceEndsAt,
      accessBlockedAt: subscription.accessBlockedAt ?? now,
      message: 'Assinatura bloqueada.',
    };
  }

  private resolveGraceEndsAt(
    referenceDate: Date | null,
    graceDays?: number | null,
  ): Date | null {
    if (!referenceDate) return null;

    const resolvedGraceDays =
      graceDays ?? BillingAccessService.DEFAULT_GRACE_DAYS;

    const graceEndsAt = new Date(referenceDate);
    graceEndsAt.setDate(graceEndsAt.getDate() + resolvedGraceDays);

    return graceEndsAt;
  }
}