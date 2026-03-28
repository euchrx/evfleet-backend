import { BillingService } from './billing.service';
import { InfinitePayGateway } from './gateways/infinitepay.gateway';
import { createInMemoryBillingPrisma } from './test-utils/in-memory-billing-prisma';

describe('Billing Flow Integration (Service + InMemory Prisma)', () => {
  it('executa fluxo principal: assinatura -> pagamento -> consulta -> webhook', async () => {
    const { prisma } = createInMemoryBillingPrisma({
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
    });

    const gateway = {
      createCheckoutLink: jest
        .fn()
        .mockResolvedValue({
          gatewayReference: 'gw_1',
          checkoutUrl: 'https://checkout.local/1',
          rawResponse: { id: 'gw_1' },
        }),
    } as unknown as InfinitePayGateway;

    const service = new BillingService(prisma as any, gateway);

    const subscription = await service.createSubscriptionForCompany('company_1', 'plan_1');
    const initialPayment = await service.createInitialPaymentForSubscription(
      subscription.id,
      'company_1',
    );
    expect(initialPayment.checkoutUrl).toBe('https://checkout.local/1');

    const summaryBefore = await service.getCompanySubscription('company_1');
    const paymentsBefore = await service.getCompanyPayments('company_1');
    expect(summaryBefore?.status).toBe('TRIALING');
    expect(paymentsBefore[0].status).toBe('PENDING');

    const webhookResult = await service.handleInfinitePayWebhook({
      id: 'evt_1',
      type: 'payment.updated',
      status: 'PAID',
      data: {
        reference: 'gw_1',
      },
    });
    expect(webhookResult.processed).toBe(true);

    const duplicate = await service.handleInfinitePayWebhook({
      id: 'evt_1',
      type: 'payment.updated',
      status: 'PAID',
      data: {
        reference: 'gw_1',
      },
    });
    expect(duplicate.duplicate).toBe(true);

    const summaryAfter = await service.getCompanySubscription('company_1');
    const paymentsAfter = await service.getCompanyPayments('company_1');
    expect(summaryAfter?.status).toBe('ACTIVE');
    expect(paymentsAfter[0].status).toBe('PAID');
  });
});

