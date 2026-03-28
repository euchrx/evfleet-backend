import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { InfinitePayGateway } from './gateways/infinitepay.gateway';
import { createInMemoryBillingPrisma } from './test-utils/in-memory-billing-prisma';

describe('BillingService Subscription + Payment', () => {
  const createService = () => {
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
    });

    const gateway = {
      createCheckoutLink: jest.fn(),
    } as unknown as InfinitePayGateway;

    const service = new BillingService(prisma as any, gateway);
    return { service, gateway: gateway as any, state };
  };

  it('cria assinatura para company ativa com plano ativo', async () => {
    const { service, state } = createService();

    const created = await service.createSubscriptionForCompany('company_1', 'plan_1');

    expect(created.companyId).toBe('company_1');
    expect(created.planId).toBe('plan_1');
    expect(created.status).toBe('TRIALING');
    expect(created.nextBillingAt).toBeTruthy();
    expect(state.subscriptions).toHaveLength(1);
  });

  it('impede duplicidade de assinatura ACTIVE/TRIALING', async () => {
    const { service } = createService();
    await service.createSubscriptionForCompany('company_1', 'plan_1');

    await expect(service.createSubscriptionForCompany('company_1', 'plan_1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('cria payment inicial com valor do plano e dados de checkout', async () => {
    const { service, gateway, state } = createService();
    const subscription = await service.createSubscriptionForCompany('company_1', 'plan_1');
    gateway.createCheckoutLink.mockResolvedValue({
      gatewayReference: 'gw_1',
      checkoutUrl: 'https://checkout.local/1',
      rawResponse: { id: 'gw_1' },
    });

    const result = await service.createInitialPaymentForSubscription(subscription.id, 'company_1');

    expect(result.checkoutUrl).toBe('https://checkout.local/1');
    expect(state.payments).toHaveLength(1);
    expect(state.payments[0].amountCents).toBe(9900);
    expect(state.payments[0].gatewayReference).toBe('gw_1');
  });

  it('marca payment como FAILED quando gateway falha', async () => {
    const { service, gateway, state } = createService();
    const subscription = await service.createSubscriptionForCompany('company_1', 'plan_1');
    gateway.createCheckoutLink.mockRejectedValue(new Error('gateway down'));

    await expect(
      service.createInitialPaymentForSubscription(subscription.id, 'company_1'),
    ).rejects.toBeTruthy();

    expect(state.payments).toHaveLength(1);
    expect(state.payments[0].status).toBe('FAILED');
  });

  it('falha se assinatura nao existir no pagamento inicial', async () => {
    const { service } = createService();
    await expect(
      service.createInitialPaymentForSubscription('sub_missing', 'company_1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('gera pagamento inicial pelo companyId (autoatendimento)', async () => {
    const { service, gateway } = createService();
    const subscription = await service.createSubscriptionForCompany('company_1', 'plan_1');
    gateway.createCheckoutLink.mockResolvedValue({
      gatewayReference: 'gw_me_1',
      checkoutUrl: 'https://checkout.local/me-1',
      rawResponse: { id: 'gw_me_1' },
    });

    const result = await service.createInitialPaymentForCompany('company_1');

    expect(result.subscriptionId).toBe(subscription.id);
    expect(result.checkoutUrl).toBe('https://checkout.local/me-1');
  });

  it('falha no autoatendimento quando empresa nao possui assinatura', async () => {
    const { service } = createService();

    await expect(service.createInitialPaymentForCompany('company_sem_sub')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('falha ao gerar payment quando valor do plano e menor que o minimo', async () => {
    const { prisma } = createInMemoryBillingPrisma({
      companies: [{ id: 'company_1', name: 'Empresa 1', active: true }],
      plans: [
        {
          id: 'plan_low',
          code: 'low',
          name: 'Plano Low',
          priceCents: 99,
          currency: 'BRL',
          interval: 'MONTHLY',
          isActive: true,
        },
      ],
    });

    const gateway = {
      createCheckoutLink: jest.fn(),
    } as unknown as InfinitePayGateway;

    const service = new BillingService(prisma as any, gateway);
    const subscription = await service.createSubscriptionForCompany('company_1', 'plan_low');

    await expect(
      service.createInitialPaymentForSubscription(subscription.id, 'company_1'),
    ).rejects.toThrow('Valor mínimo para pagamento é');
    expect((gateway as any).createCheckoutLink).not.toHaveBeenCalled();
  });
});
