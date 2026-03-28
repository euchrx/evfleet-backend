import {
  BillingGateway,
  PaymentStatus,
  PlanInterval,
  SubscriptionStatus,
  WebhookProcessStatus,
} from '@prisma/client';
import { BillingService } from './billing.service';
import { InfinitePayGateway } from './gateways/infinitepay.gateway';

describe('BillingService Webhook', () => {
  const createService = () => {
    const prisma = {
      plan: { findMany: jest.fn() },
      subscription: { findFirst: jest.fn(), findUnique: jest.fn() },
      payment: { create: jest.fn(), findFirst: jest.fn() },
      webhookEvent: { create: jest.fn(), update: jest.fn() },
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

  it('processa pagamento confirmado e ativa assinatura', async () => {
    const { service, prisma } = createService();
    prisma.webhookEvent.create.mockResolvedValue({ id: 'wh_1' });

    const tx = {
      payment: {
        findFirst: jest.fn().mockResolvedValue({ id: 'pay_1' }),
        update: jest.fn().mockResolvedValue({
          id: 'pay_1',
          companyId: 'company_1',
          subscriptionId: 'sub_1',
          subscription: {
            plan: { interval: PlanInterval.MONTHLY },
          },
        }),
      },
      subscription: {
        update: jest.fn().mockResolvedValue({ id: 'sub_1' }),
      },
      webhookEvent: {
        update: jest.fn().mockResolvedValue({ id: 'wh_1' }),
      },
    };

    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const result = await service.handleInfinitePayWebhook({
      id: 'evt_1',
      type: 'payment.updated',
      capture_method: 'PAID',
      order_nsu: 'ref_123',
      transaction_nsu: 'txn_123',
      invoice_slug: 'invoice_123',
      receipt_url: 'https://infinitepay.io/receipt/123',
      paid_at: '2026-03-27T00:00:00.000Z',
    });

    expect(result).toEqual({
      duplicate: false,
      processed: true,
      paymentId: 'pay_1',
      subscriptionId: 'sub_1',
    });

    expect(prisma.webhookEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          gateway: BillingGateway.INFINITEPAY,
          eventType: 'payment.updated',
          externalEventId: 'evt_1',
          processStatus: WebhookProcessStatus.PENDING,
        }),
      }),
    );

    expect(tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay_1' },
        data: expect.objectContaining({
          status: PaymentStatus.PAID,
          gatewayReference: 'ref_123',
          externalPaymentId: 'txn_123',
          invoiceUrl: 'https://infinitepay.io/receipt/123',
        }),
      }),
    );

    const subscriptionUpdateArg = tx.subscription.update.mock.calls[0][0];
    expect(subscriptionUpdateArg.data.status).toBe(SubscriptionStatus.ACTIVE);
    expect(subscriptionUpdateArg.data.currentPeriodStart).toEqual(
      new Date('2026-03-27T00:00:00.000Z'),
    );
    expect(subscriptionUpdateArg.data.currentPeriodEnd).toEqual(
      new Date('2026-04-27T00:00:00.000Z'),
    );
    expect(subscriptionUpdateArg.data.nextBillingAt).toEqual(
      new Date('2026-04-27T00:00:00.000Z'),
    );

    expect(tx.webhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'wh_1' },
        data: expect.objectContaining({
          processStatus: WebhookProcessStatus.PROCESSED,
          processedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('ignora evento duplicado com seguranca', async () => {
    const { service, prisma } = createService();
    prisma.webhookEvent.create.mockRejectedValue({ code: 'P2002' });

    const result = await service.handleInfinitePayWebhook({
      id: 'evt_dup_1',
      type: 'payment.updated',
      status: 'PAID',
      data: { reference: 'ref_dup' },
    });

    expect(result).toEqual({
      duplicate: true,
      message: 'Evento duplicado ignorado com segurança.',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.webhookEvent.update).not.toHaveBeenCalled();
  });

  it('usa periodo informado no payload na transicao da assinatura', async () => {
    const { service, prisma } = createService();
    prisma.webhookEvent.create.mockResolvedValue({ id: 'wh_2' });

    const tx = {
      payment: {
        findFirst: jest.fn().mockResolvedValue({ id: 'pay_2' }),
        update: jest.fn().mockResolvedValue({
          id: 'pay_2',
          companyId: 'company_2',
          subscriptionId: 'sub_2',
          subscription: {
            plan: { interval: PlanInterval.YEARLY },
          },
        }),
      },
      subscription: {
        update: jest.fn().mockResolvedValue({ id: 'sub_2' }),
      },
      webhookEvent: {
        update: jest.fn().mockResolvedValue({ id: 'wh_2' }),
      },
    };

    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const result = await service.handleInfinitePayWebhook({
      id: 'evt_2',
      type: 'payment.succeeded',
      status: 'CONFIRMED',
      data: {
        reference: 'ref_456',
        periodStart: '2026-01-01T00:00:00.000Z',
        periodEnd: '2026-12-31T00:00:00.000Z',
      },
    });

    expect(result).toEqual({
      duplicate: false,
      processed: true,
      paymentId: 'pay_2',
      subscriptionId: 'sub_2',
    });

    const subscriptionUpdateArg = tx.subscription.update.mock.calls[0][0];
    expect(subscriptionUpdateArg.data.status).toBe(SubscriptionStatus.ACTIVE);
    expect(subscriptionUpdateArg.data.currentPeriodStart).toEqual(
      new Date('2026-01-01T00:00:00.000Z'),
    );
    expect(subscriptionUpdateArg.data.currentPeriodEnd).toEqual(
      new Date('2026-12-31T00:00:00.000Z'),
    );
    expect(subscriptionUpdateArg.data.nextBillingAt).toEqual(
      new Date('2026-12-31T00:00:00.000Z'),
    );
  });

  it('usa payment_check opcional para confirmar pagamento quando status nao veio confirmado', async () => {
    const { service, prisma } = createService();
    prisma.webhookEvent.create.mockResolvedValue({ id: 'wh_3' });

    const tx = {
      payment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'pay_3',
          metadata: {},
        }),
        update: jest.fn().mockResolvedValue({
          id: 'pay_3',
          companyId: 'company_3',
          subscriptionId: 'sub_3',
          subscription: {
            plan: { interval: PlanInterval.MONTHLY },
          },
        }),
      },
      subscription: {
        update: jest.fn().mockResolvedValue({ id: 'sub_3' }),
      },
      webhookEvent: {
        update: jest.fn().mockResolvedValue({ id: 'wh_3' }),
      },
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    (service as any).infinitePayGateway.checkPayment = jest.fn().mockResolvedValue({
      status: 'PAID',
    });

    const result = await service.handleInfinitePayWebhook({
      id: 'evt_3',
      type: 'payment.updated',
      status: 'PENDING',
      order_nsu: 'order_3',
      payment_check: true,
    });

    expect(result).toEqual({
      duplicate: false,
      processed: true,
      paymentId: 'pay_3',
      subscriptionId: 'sub_3',
    });
    expect((service as any).infinitePayGateway.checkPayment).toHaveBeenCalledWith(
      'order_3',
    );
  });
});
