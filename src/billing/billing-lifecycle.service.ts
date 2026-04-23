import { Injectable } from '@nestjs/common';
import { PaymentStatus, Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BillingLifecycleService {
  private static readonly MIN_INTERVAL_MS = 60_000;
  private static readonly DEFAULT_GRACE_DAYS = 5;

  private lastRunAtMs = 0;

  constructor(private readonly prisma: PrismaService) {}

  async processOverduePaymentsIfNeeded(now = new Date()) {
    const nowMs = now.getTime();

    if (nowMs - this.lastRunAtMs < BillingLifecycleService.MIN_INTERVAL_MS) {
      return {
        skipped: true,
        expiredPayments: 0,
        subscriptionsPastDue: 0,
        subscriptionsBlocked: 0,
      };
    }

    const result = await this.processOverduePayments(now);
    this.lastRunAtMs = nowMs;
    return result;
  }

  async processOverduePayments(now = new Date()) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const expiredTrialSubscriptions = await tx.subscription.findMany({
        where: {
          status: SubscriptionStatus.TRIALING,
          trialEndsAt: { lt: now },
        },
        select: {
          id: true,
          trialEndsAt: true,
          graceDays: true,
          graceEndsAt: true,
        },
      });

      let expiredTrialsCount = 0;

      for (const subscription of expiredTrialSubscriptions) {
        const graceEndsAt =
          subscription.graceEndsAt ??
          this.resolveGraceEndsAt(
            subscription.trialEndsAt,
            subscription.graceDays,
          );

        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            status: SubscriptionStatus.PAST_DUE,
            graceEndsAt,
            accessBlockedAt: null,
          },
        });

        expiredTrialsCount += 1;
      }

      const expiredPaymentsResult = await tx.payment.updateMany({
        where: {
          status: PaymentStatus.PENDING,
          dueDate: { lt: now },
        },
        data: {
          status: PaymentStatus.EXPIRED,
        },
      });

      const subscriptionsToMarkPastDue = await tx.payment.findMany({
        where: {
          status: PaymentStatus.EXPIRED,
          subscription: {
            status: {
              in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
            },
          },
        },
        select: {
          subscriptionId: true,
          subscription: {
            select: {
              id: true,
              currentPeriodEnd: true,
              nextBillingAt: true,
              graceDays: true,
              graceEndsAt: true,
            },
          },
        },
        distinct: ['subscriptionId'],
      });

      let subscriptionsPastDueCount = 0;

      for (const item of subscriptionsToMarkPastDue) {
        const subscription = item.subscription;
        if (!subscription) continue;

        const referenceDate =
          subscription.currentPeriodEnd ?? subscription.nextBillingAt ?? now;

        const graceEndsAt =
          subscription.graceEndsAt ??
          this.resolveGraceEndsAt(referenceDate, subscription.graceDays);

        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            status: SubscriptionStatus.PAST_DUE,
            graceEndsAt,
            accessBlockedAt: null,
          },
        });

        subscriptionsPastDueCount += 1;
      }

      const subscriptionsToBlock = await tx.subscription.findMany({
        where: {
          status: SubscriptionStatus.PAST_DUE,
          graceEndsAt: { lt: now },
          OR: [
            { accessBlockedAt: null },
            { accessBlockedAt: undefined as never },
          ],
        },
        select: { id: true },
      });

      let subscriptionsBlockedCount = 0;

      if (subscriptionsToBlock.length > 0) {
        const ids = subscriptionsToBlock.map((item) => item.id);

        const blockResult = await tx.subscription.updateMany({
          where: {
            id: { in: ids },
            status: SubscriptionStatus.PAST_DUE,
          },
          data: {
            accessBlockedAt: now,
          },
        });

        subscriptionsBlockedCount = blockResult.count;
      }

      return {
        skipped: false,
        expiredPayments: expiredPaymentsResult.count,
        subscriptionsPastDue:
          subscriptionsPastDueCount + expiredTrialsCount,
        subscriptionsBlocked: subscriptionsBlockedCount,
      };
    });
  }

  private resolveGraceEndsAt(
    referenceDate: Date | null,
    graceDays?: number | null,
  ) {
    if (!referenceDate) return null;

    const resolvedGraceDays =
      graceDays ?? BillingLifecycleService.DEFAULT_GRACE_DAYS;

    const graceEndsAt = new Date(referenceDate);
    graceEndsAt.setDate(graceEndsAt.getDate() + resolvedGraceDays);

    return graceEndsAt;
  }
}