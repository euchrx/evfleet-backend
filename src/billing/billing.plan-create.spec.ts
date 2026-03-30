import { BadRequestException } from '@nestjs/common';
import { PlanInterval } from '@prisma/client';
import { BillingService } from './billing.service';
import { InfinitePayGateway } from './gateways/infinitepay.gateway';

describe('BillingService createPlan', () => {
  const createService = () => {
    const prisma = {
      plan: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
      subscription: { findFirst: jest.fn(), findUnique: jest.fn() },
      payment: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      webhookEvent: { create: jest.fn(), update: jest.fn() },
      company: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    } as any;

    const infinitePayGateway = {
      createCheckoutLink: jest.fn(),
    } as unknown as InfinitePayGateway;

    const service = new BillingService(prisma, infinitePayGateway);
    return { service, prisma };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cria plan com sucesso', async () => {
    const { service, prisma } = createService();
    const createdAt = new Date('2026-03-27T10:00:00.000Z');

    prisma.plan.findUnique.mockResolvedValue(null);
    prisma.plan.create.mockResolvedValue({
      id: 'plan_1',
      code: 'PRO',
      name: 'Plano Pro',
      description: 'Plano completo',
      priceCents: 19900,
      vehicleLimit: 25,
      currency: 'BRL',
      interval: PlanInterval.MONTHLY,
      isActive: true,
      createdAt,
    });

    const result = await service.createPlan({
      code: 'pro',
      name: 'Plano Pro',
      description: 'Plano completo',
      priceCents: 19900,
      vehicleLimit: 25,
      interval: PlanInterval.MONTHLY,
    });

    expect(prisma.plan.findUnique).toHaveBeenCalledWith({
      where: { code: 'PRO' },
      select: { id: true },
    });

    expect(result).toEqual({
      id: 'plan_1',
      code: 'PRO',
      name: 'Plano Pro',
      description: 'Plano completo',
      priceCents: 19900,
      vehicleLimit: 25,
      currency: 'BRL',
      interval: PlanInterval.MONTHLY,
      active: true,
      createdAt,
    });
  });

  it('falha em code duplicado', async () => {
    const { service, prisma } = createService();
    prisma.plan.findUnique.mockResolvedValue({ id: 'plan_exists' });

    await expect(
      service.createPlan({
        code: 'PRO',
        name: 'Plano Pro',
        priceCents: 19900,
        interval: PlanInterval.MONTHLY,
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.createPlan({
        code: 'PRO',
        name: 'Plano Pro',
        priceCents: 19900,
        interval: PlanInterval.MONTHLY,
      }),
    ).rejects.toThrow('Código do plano já está em uso.');
  });

  it('falha em priceCents inválido', async () => {
    const { service } = createService();

    await expect(
      service.createPlan({
        code: 'BASIC',
        name: 'Plano Basic',
        priceCents: 99,
        interval: PlanInterval.MONTHLY,
      }),
    ).rejects.toThrow('Valor mínimo para pagamento é');
  });
});
