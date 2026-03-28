import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionStatus } from '@prisma/client';
import { BillingLifecycleService } from '../billing/billing-lifecycle.service';
import { PrismaService } from '../prisma/prisma.service';
import { ALLOW_INADIMPLENTE_ACCESS_KEY } from './allow-inadimplente-access.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';
import { SubscriptionAccessGuard } from './subscription-access.guard';

describe('SubscriptionAccessGuard', () => {
  const createGuard = () => {
    const reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as Reflector;

    const prisma = {
      subscription: {
        findFirst: jest.fn(),
      },
    } as unknown as PrismaService;

    const billingLifecycleService = {
      processOverduePaymentsIfNeeded: jest.fn().mockResolvedValue({
        skipped: true,
        expiredPayments: 0,
        subscriptionsPastDue: 0,
      }),
    } as unknown as BillingLifecycleService;

    const guard = new SubscriptionAccessGuard(reflector, prisma, billingLifecycleService);
    return {
      guard,
      reflector: reflector as any,
      prisma: prisma as any,
      billingLifecycleService: billingLifecycleService as any,
    };
  };

  const createContext = (user: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('usuario ativo acessa', async () => {
    const { guard, reflector, prisma } = createGuard();

    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === ALLOW_INADIMPLENTE_ACCESS_KEY) return false;
      return undefined;
    });

    prisma.subscription.findFirst.mockResolvedValue({
      status: SubscriptionStatus.ACTIVE,
    });

    const result = await guard.canActivate(createContext({ userId: 'user_1', companyId: 'company_1' }));

    expect(result).toBe(true);
    expect(prisma.subscription.findFirst).toHaveBeenCalled();
  });

  it('usuario inadimplente e bloqueado', async () => {
    const { guard, reflector, prisma } = createGuard();

    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === ALLOW_INADIMPLENTE_ACCESS_KEY) return false;
      return undefined;
    });

    prisma.subscription.findFirst.mockResolvedValue({
      status: SubscriptionStatus.PAST_DUE,
    });

    await expect(
      guard.canActivate(createContext({ userId: 'user_2', companyId: 'company_2' })),
    ).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rota publica continua acessivel', async () => {
    const { guard, reflector, prisma, billingLifecycleService } = createGuard();

    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return true;
      if (key === ALLOW_INADIMPLENTE_ACCESS_KEY) return false;
      return undefined;
    });

    const result = await guard.canActivate(createContext(undefined));

    expect(result).toBe(true);
    expect(prisma.subscription.findFirst).not.toHaveBeenCalled();
    expect(billingLifecycleService.processOverduePaymentsIfNeeded).not.toHaveBeenCalled();
  });

  it('rota de billing continua acessivel para regularizacao', async () => {
    const { guard, reflector, prisma, billingLifecycleService } = createGuard();

    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === ALLOW_INADIMPLENTE_ACCESS_KEY) return true;
      return undefined;
    });

    const result = await guard.canActivate(
      createContext({ userId: 'user_3', companyId: 'company_3' }),
    );

    expect(result).toBe(true);
    expect(prisma.subscription.findFirst).not.toHaveBeenCalled();
    expect(billingLifecycleService.processOverduePaymentsIfNeeded).not.toHaveBeenCalled();
  });
});
