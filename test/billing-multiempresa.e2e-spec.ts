import { CanActivate, Controller, Get, INestApplication, Injectable } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { createHmac } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { IS_PUBLIC_KEY, Public } from '../src/auth/public.decorator';
import { RolesGuard } from '../src/auth/roles.guard';
import { SubscriptionAccessGuard } from '../src/auth/subscription-access.guard';
import { BillingController } from '../src/billing/billing.controller';
import { BillingLifecycleService } from '../src/billing/billing-lifecycle.service';
import { BillingWebhookSignatureService } from '../src/billing/billing-webhook-signature.service';
import { BillingService } from '../src/billing/billing.service';
import { InfinitePayGateway } from '../src/billing/gateways/infinitepay.gateway';
import { createInMemoryBillingPrisma } from '../src/billing/test-utils/in-memory-billing-prisma';
import { CreateCheckoutForSubscriptionUseCase } from '../src/billing/use-cases/create-checkout-for-subscription.use-case';
import { CreateInitialPaymentForSubscriptionUseCase } from '../src/billing/use-cases/create-initial-payment-for-subscription.use-case';
import { CreateSubscriptionForCompanyUseCase } from '../src/billing/use-cases/create-subscription-for-company.use-case';
import { PrismaService } from '../src/prisma/prisma.service';

@Controller('protected')
class ProtectedController {
  @Get('secure')
  secure() {
    return { ok: true };
  }

  @Public()
  @Get('public')
  publicRoute() {
    return { ok: true };
  }
}

@Injectable()
class FakeJwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: any): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    request.user = {
      userId: request.headers['x-user-id'] || 'user_e2e',
      role: request.headers['x-role'] || 'ADMIN',
      companyId: request.headers['x-company-id'] || 'company_1',
      email: 'e2e@evfleet.com',
    };
    return true;
  }
}

describe('Billing Multiempresa (e2e)', () => {
  let app: INestApplication<App>;
  let state: ReturnType<typeof createInMemoryBillingPrisma>['state'];
  const webhookSecret = 'e2e_webhook_secret';

  const signPayload = (payload: unknown) =>
    createHmac('sha256', webhookSecret).update(Buffer.from(JSON.stringify(payload))).digest('hex');

  beforeAll(async () => {
    const inMemory = createInMemoryBillingPrisma({
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
    state = inMemory.state;

    const gatewayMock = {
      createCheckoutLink: jest.fn().mockResolvedValue({
        gatewayReference: 'gw_e2e_1',
        checkoutUrl: 'https://checkout.local/e2e-1',
        rawResponse: { id: 'gw_e2e_1' },
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [BillingController, ProtectedController],
      providers: [
        { provide: PrismaService, useValue: inMemory.prisma },
        BillingService,
        BillingLifecycleService,
        BillingWebhookSignatureService,
        CreateCheckoutForSubscriptionUseCase,
        CreateInitialPaymentForSubscriptionUseCase,
        CreateSubscriptionForCompanyUseCase,
        { provide: APP_GUARD, useClass: FakeJwtAuthGuard },
        { provide: APP_GUARD, useClass: SubscriptionAccessGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: InfinitePayGateway, useValue: gatewayMock },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'INFINITEPAY_WEBHOOK_SECRET') return webhookSecret;
              if (key === 'INFINITEPAY_WEBHOOK_SIGNATURE_HEADER') return 'x-infinitepay-signature';
              return undefined;
            },
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('fluxo http minimo: assinatura, pagamento, consultas e webhook', async () => {
    const createSubscription = await request(app.getHttpServer())
      .post('/billing/companies/company_1/subscription')
      .set('x-role', 'ADMIN')
      .set('x-company-id', 'company_1')
      .send({ planId: 'plan_1' })
      .expect(201);

    const subscriptionId = createSubscription.body.id;
    expect(subscriptionId).toBeTruthy();

    const createPayment = await request(app.getHttpServer())
      .post(`/billing/subscriptions/${subscriptionId}/pay`)
      .set('x-role', 'ADMIN')
      .set('x-company-id', 'company_1')
      .send({})
      .expect(201);

    expect(createPayment.body.checkoutUrl).toBe('https://checkout.local/e2e-1');

    await request(app.getHttpServer())
      .get('/billing/companies/company_1/subscription')
      .set('x-role', 'ADMIN')
      .set('x-company-id', 'company_1')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('TRIALING');
      });

    await request(app.getHttpServer())
      .get('/billing/companies/company_1/payments')
      .set('x-role', 'ADMIN')
      .set('x-company-id', 'company_1')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
      });

    const webhookPayload = {
      id: 'evt_e2e_1',
      type: 'payment.updated',
      status: 'PAID',
      data: {
        reference: 'gw_e2e_1',
      },
    };
    const webhookSignature = signPayload(webhookPayload);

    await request(app.getHttpServer())
      .post('/billing/webhooks/infinitepay')
      .set('x-infinitepay-signature', webhookSignature)
      .send(webhookPayload)
      .expect(201);

    await request(app.getHttpServer())
      .get('/billing/companies/company_1/subscription')
      .set('x-role', 'ADMIN')
      .set('x-company-id', 'company_1')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ACTIVE');
      });
  });

  it('valida bloqueio/liberacao por assinatura em rota protegida', async () => {
    await request(app.getHttpServer())
      .get('/protected/public')
      .expect(200)
      .expect({ ok: true });

    await request(app.getHttpServer())
      .get('/protected/secure')
      .set('x-role', 'ADMIN')
      .set('x-company-id', 'company_1')
      .expect(200)
      .expect({ ok: true });

    const companySubscription = state.subscriptions.find((item) => item.companyId === 'company_1');
    if (!companySubscription) throw new Error('subscription not found in state');
    companySubscription.status = 'PAST_DUE';

    await request(app.getHttpServer())
      .get('/protected/secure')
      .set('x-role', 'ADMIN')
      .set('x-company-id', 'company_1')
      .expect(403);

    await request(app.getHttpServer())
      .get('/billing/companies/company_1/subscription')
      .set('x-role', 'ADMIN')
      .set('x-company-id', 'company_1')
      .expect(200);

    await request(app.getHttpServer())
      .get('/billing/me/subscription')
      .set('x-role', 'FLEET_MANAGER')
      .set('x-company-id', 'company_1')
      .expect(200);

    await request(app.getHttpServer())
      .get('/billing/me/payments')
      .set('x-role', 'FLEET_MANAGER')
      .set('x-company-id', 'company_1')
      .expect(200);

    await request(app.getHttpServer())
      .post('/billing/me/pay')
      .set('x-role', 'FLEET_MANAGER')
      .set('x-company-id', 'company_1')
      .send({})
      .expect(201)
      .expect((res) => {
        expect(res.body.checkoutUrl).toBeTruthy();
      });
  });

  it('rejeita webhook sem assinatura ou com assinatura invalida', async () => {
    const payload = {
      id: 'evt_e2e_2',
      type: 'payment.updated',
      status: 'PAID',
      data: {
        reference: 'gw_e2e_1',
      },
    };

    await request(app.getHttpServer())
      .post('/billing/webhooks/infinitepay')
      .send(payload)
      .expect(401);

    await request(app.getHttpServer())
      .post('/billing/webhooks/infinitepay')
      .set('x-infinitepay-signature', 'invalid')
      .send(payload)
      .expect(401);
  });
});
