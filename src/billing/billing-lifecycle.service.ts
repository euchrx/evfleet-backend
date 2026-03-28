import { Injectable } from '@nestjs/common';
import { PaymentStatus, Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BillingLifecycleService {
  private static readonly MIN_INTERVAL_MS = 60_000;
  private lastRunAtMs = 0;

  constructor(private readonly prisma: PrismaService) {}

  async processOverduePaymentsIfNeeded(now = new Date()) {
    const nowMs = now.getTime();
    if (nowMs - this.lastRunAtMs < BillingLifecycleService.MIN_INTERVAL_MS) {
      return { skipped: true, expiredPayments: 0, subscriptionsPastDue: 0 };
    }

    const result = await this.processOverduePayments(now);
    this.lastRunAtMs = nowMs;
    return result;
  }

  // Estrutura pronta para scheduler (@Cron) quando o módulo de agendamento for habilitado.
  async processOverduePayments(now = new Date()) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const expiredPaymentsResult = await tx.payment.updateMany({
        where: {
          status: PaymentStatus.PENDING,
          dueDate: { lt: now },
        },
        data: {
          status: PaymentStatus.EXPIRED,
        },
      });

      const subscriptionsToUpdate = await tx.payment.findMany({
        where: {
          status: PaymentStatus.EXPIRED,
          subscription: {
            status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] },
          },
        },
        select: { subscriptionId: true },
        distinct: ['subscriptionId'],
      });

      const subscriptionIds = subscriptionsToUpdate.map((item) => item.subscriptionId);
      const pastDueResult =
        subscriptionIds.length > 0
          ? await tx.subscription.updateMany({
              where: {
                id: { in: subscriptionIds },
                status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] },
              },
              data: { status: SubscriptionStatus.PAST_DUE },
            })
          : { count: 0 };

      return {
        skipped: false,
        expiredPayments: expiredPaymentsResult.count,
        subscriptionsPastDue: pastDueResult.count,
      };
    });
  }
}

