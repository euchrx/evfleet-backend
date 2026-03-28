import { BillingLifecycleService } from './billing-lifecycle.service';
import { createInMemoryBillingPrisma } from './test-utils/in-memory-billing-prisma';

describe('BillingLifecycleService', () => {
  it('marca payment vencido como EXPIRED e assinatura como PAST_DUE', async () => {
    const now = new Date('2026-03-27T12:00:00.000Z');
    const dueYesterday = new Date('2026-03-26T12:00:00.000Z');

    const { prisma, state } = createInMemoryBillingPrisma({
      companies: [{ id: 'company_1', name: 'Empresa 1', active: true }],
      plans: [
        {
          id: 'plan_1',
          code: 'basic',
          name: 'Plano Básico',
          priceCents: 9900,
          currency: 'BRL',
          interval: 'MONTHLY',
          isActive: true,
        },
      ],
      subscriptions: [
        {
          id: 'sub_1',
          companyId: 'company_1',
          planId: 'plan_1',
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: now,
          nextBillingAt: now,
          createdAt: now,
          updatedAt: now,
        },
      ],
      payments: [
        {
          id: 'pay_1',
          companyId: 'company_1',
          subscriptionId: 'sub_1',
          gateway: 'INFINITEPAY',
          status: 'PENDING',
          amountCents: 9900,
          currency: 'BRL',
          dueDate: dueYesterday,
          paidAt: null,
          gatewayReference: null,
          checkoutUrl: null,
          externalPaymentId: null,
          metadata: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    const service = new BillingLifecycleService(prisma as any);
    const result = await service.processOverduePayments(now);

    expect(result.expiredPayments).toBe(1);
    expect(result.subscriptionsPastDue).toBe(1);
    expect(state.payments[0].status).toBe('EXPIRED');
    expect(state.subscriptions[0].status).toBe('PAST_DUE');
  });
});

