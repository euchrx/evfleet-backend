import {
  Optional,
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BillingGateway,
  PaymentStatus,
  PlanInterval,
  Prisma,
  SubscriptionStatus,
  WebhookProcessStatus,
} from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreateSubscriptionCheckoutDto } from './dto/create-subscription-checkout.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { InfinitePayGateway } from './gateways/infinitepay.gateway';

type InfinitePayWebhookNormalized = {
  dedupKey: string;
  eventType: string;
  paymentStatus: string;
  amount?: number;
  paidAmount?: number;
  orderNsu?: string;
  transactionNsu?: string;
  invoiceSlug?: string;
  receiptUrl?: string;
  subscriptionIdHint?: string;
  companyIdHint?: string;
  paidAt?: Date;
  periodStart?: Date;
  periodEnd?: Date;
  paymentCheckEnabled?: boolean;
  rawPayload: unknown;
};

type CompanySubscriptionInitialStatus = Extract<
  SubscriptionStatus,
  'TRIALING' | 'ACTIVE'
>;

type CheckPaymentInput = {
  order_nsu: string;
  transaction_nsu?: string;
  slug?: string;
};

@Injectable()
export class BillingService {
  private readonly MANUAL_TRIAL_DAYS = 15;
  private readonly MANUAL_ACTIVE_DAYS = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly infinitePayGateway: InfinitePayGateway,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  async listPlans(companyId?: string) {
    const orderBy = [{ active: 'desc' as const }, { priceCents: 'asc' as const }];

    if (!companyId?.trim()) {
      return this.prisma.plan.findMany({
        orderBy,
        include: { company: { select: { id: true, name: true } } },
      });
    }

    const normalizedCompanyId = companyId.trim();
    const enterprisePlans = await this.prisma.plan.findMany({
      where: {
        active: true,
        isEnterprise: true,
        companyId: normalizedCompanyId,
      },
      orderBy,
      include: { company: { select: { id: true, name: true } } },
    });

    if (enterprisePlans.length > 0) {
      return enterprisePlans;
    }

    return this.prisma.plan.findMany({
      where: {
        active: true,
        isPublic: true,
      },
      orderBy,
      include: { company: { select: { id: true, name: true } } },
    });
  }

  async createPlan(dto: CreatePlanDto) {
    const code = dto.code?.trim().toUpperCase();
    const name = dto.name?.trim();
    const description = dto.description?.trim();
    const currency = (dto.currency?.trim() || 'BRL').toUpperCase();
    const visibility = this.resolvePlanVisibility(dto.isPublic, dto.isEnterprise);
    const companyId = dto.companyId?.trim() || null;

    if (!name) {
      throw new BadRequestException('Nome do plano é obrigatório.');
    }
    if (!code) {
      throw new BadRequestException('Código do plano é obrigatório.');
    }
    if (!Number.isInteger(dto.priceCents) || dto.priceCents <= 0) {
      throw new BadRequestException('priceCents deve ser maior que zero.');
    }
    if (dto.priceCents < this.getMinAmountCents()) {
      throw new BadRequestException(this.getMinAmountErrorMessage());
    }

    await this.validatePlanCompanyAssignment({
      companyId,
      isPublic: visibility.isPublic,
      isEnterprise: visibility.isEnterprise,
    });

    const existingCode = await this.prisma.plan.findUnique({
      where: { code },
      select: { id: true },
    });
    if (existingCode) {
      throw new BadRequestException('Código do plano já está em uso.');
    }

    try {
      const plan = await this.prisma.plan.create({
        data: {
          code,
          name,
          description: description || null,
          priceCents: dto.priceCents,
          vehicleLimit:
            dto.vehicleLimit !== undefined ? Number(dto.vehicleLimit) : null,
          currency,
          interval: dto.interval,
          active: dto.active ?? true,
          isPublic: visibility.isPublic,
          isEnterprise: visibility.isEnterprise,
          companyId,
        },
        include: { company: { select: { id: true, name: true } } },
      });

      return this.mapPlanSummary(plan);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('Código do plano já está em uso.');
      }
      throw error;
    }
  }

  async updatePlan(planId: string, dto: UpdatePlanDto) {
    const existingPlan = await this.prisma.plan.findUnique({
      where: { id: planId },
      select: {
        id: true,
        code: true,
        isPublic: true,
        isEnterprise: true,
        companyId: true,
      },
    });

    if (!existingPlan) {
      throw new NotFoundException('Plano não encontrado.');
    }

    const code = dto.code?.trim().toUpperCase();
    const name = dto.name?.trim();
    const description = dto.description?.trim();
    const currency = dto.currency?.trim().toUpperCase();
    const visibility = this.resolvePlanVisibility(
      dto.isPublic ?? existingPlan.isPublic,
      dto.isEnterprise ?? existingPlan.isEnterprise,
    );
    const companyId = dto.companyId !== undefined ? dto.companyId?.trim() || null : existingPlan.companyId;

    if (dto.priceCents !== undefined) {
      if (!Number.isInteger(dto.priceCents) || dto.priceCents <= 0) {
        throw new BadRequestException('priceCents deve ser maior que zero.');
      }
      if (dto.priceCents < this.getMinAmountCents()) {
        throw new BadRequestException(this.getMinAmountErrorMessage());
      }
    }

    await this.validatePlanCompanyAssignment({
      companyId,
      isPublic: visibility.isPublic,
      isEnterprise: visibility.isEnterprise,
    });

    if (code && code !== existingPlan.code) {
      const codeInUse = await this.prisma.plan.findUnique({
        where: { code },
        select: { id: true },
      });
      if (codeInUse) {
        throw new BadRequestException('Código do plano já está em uso.');
      }
    }

    try {
      const updated = await this.prisma.plan.update({
        where: { id: planId },
        data: {
          ...(code ? { code } : {}),
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined ? { description: description || null } : {}),
          ...(dto.priceCents !== undefined ? { priceCents: dto.priceCents } : {}),
          ...(dto.vehicleLimit !== undefined
            ? { vehicleLimit: Number(dto.vehicleLimit) }
            : {}),
          ...(currency !== undefined ? { currency } : {}),
          ...(dto.interval !== undefined ? { interval: dto.interval } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
          ...(dto.isPublic !== undefined || dto.isEnterprise !== undefined
            ? {
                isPublic: visibility.isPublic,
                isEnterprise: visibility.isEnterprise,
              }
            : {}),
          ...(dto.companyId !== undefined || companyId !== existingPlan.companyId
            ? { companyId }
            : {}),
        },
        include: { company: { select: { id: true, name: true } } },
      });

      return this.mapPlanSummary(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('Código do plano já está em uso.');
      }
      throw error;
    }
  }

  async deletePlan(planId: string) {
    const existingPlan = await this.prisma.plan.findUnique({
      where: { id: planId },
      select: {
        id: true,
        name: true,
        companyId: true,
        subscriptions: {
          select: {
            id: true,
            companyId: true,
            status: true,
          },
        },
      },
    });

    if (!existingPlan) {
      throw new NotFoundException('Plano não encontrado.');
    }

    const resetCompanyIds = Array.from(
      new Set(
        existingPlan.subscriptions
          .map((subscription) => subscription.companyId)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    await this.prisma.$transaction(async (tx) => {
      if (existingPlan.subscriptions.length > 0) {
        const subscriptionIds = existingPlan.subscriptions.map((subscription) => subscription.id);

        await tx.payment.deleteMany({
          where: {
            subscriptionId: { in: subscriptionIds },
          },
        });

        await tx.webhookEvent.updateMany({
          where: {
            subscriptionId: { in: subscriptionIds },
          },
          data: {
            subscriptionId: null,
            companyId: null,
          },
        });

        await tx.subscription.deleteMany({
          where: {
            id: { in: subscriptionIds },
          },
        });
      }

      await tx.plan.delete({ where: { id: planId } });
    });

    return {
      id: existingPlan.id,
      name: existingPlan.name,
      removed: true,
      resetCompanies: resetCompanyIds.map((companyId) => ({
        companyId,
        operationalStatus: 'NO_PLAN',
      })),
      message:
        resetCompanyIds.length > 0
          ? 'Plano removido com reset total das empresas vinculadas.'
          : 'Plano removido com sucesso.',
    };
  }

  async getCompanySubscription(companyId: string) {

    const subscription = await this.prisma.subscription.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });

    if (!subscription) return null;

    return {
      id: subscription.id,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      nextBillingAt: subscription.nextBillingAt,
      plan: {
        id: subscription.plan.id,
        code: subscription.plan.code,
        name: subscription.plan.name,
        priceCents: subscription.plan.priceCents,
        currency: subscription.plan.currency,
        interval: subscription.plan.interval,
        isPublic: subscription.plan.isPublic,
        isEnterprise: subscription.plan.isEnterprise,
        companyId: subscription.plan.companyId,
      },
    };
  }

  async getCompanyPayments(companyId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amountCents: true,
        currency: true,
        status: true,
        dueDate: true,
        paidAt: true,
        checkoutUrl: true,
      },
    });

    return payments.map((payment) => ({
      id: payment.id,
      amount: payment.amountCents,
      currency: payment.currency,
      status: payment.status,
      dueAt: payment.dueDate,
      paidAt: payment.paidAt,
      checkoutUrl: payment.checkoutUrl,
    }));
  }

  async clearCompanyPayments(companyId: string) {
    if (!companyId?.trim()) {
      throw new BadRequestException('companyId é obrigatório.');
    }

    const deleted = await this.prisma.payment.deleteMany({
      where: { companyId },
    });

    return {
      companyId,
      deletedCount: deleted.count,
    };
  }

  async createSubscriptionForCompany(
    companyId: string,
    planId: string,
    initialStatus?: CompanySubscriptionInitialStatus,
  ) {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { id: true, active: true },
      });
      if (!company) {
        throw new NotFoundException('Empresa não encontrada.');
      }
      if (!company.active) {
        throw new BadRequestException('Empresa inativa não pode receber assinatura.');
      }

      const existing = await tx.subscription.findFirst({
        where: {
          companyId,
          status: {
            in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
          },
        },
        include: { plan: true },
      });

      const plan = await tx.plan.findUnique({
        where: { id: planId },
        select: {
          id: true,
          code: true,
          name: true,
          active: true,
          interval: true,
          isPublic: true,
          isEnterprise: true,
          companyId: true,
        },
      });
      if (!plan) {
        throw new NotFoundException('Plano não encontrado.');
      }
      if (!plan.active) {
        throw new BadRequestException('Plano inativo não pode ser utilizado.');
      }
      this.assertPlanAvailabilityForCompany(companyId, plan);

      const resolvedInitialStatus = await this.resolveSubscriptionInitialStatus(
        tx,
        companyId,
        plan,
        initialStatus,
        existing?.id,
        now,
      );
      const nextPeriodEnd =
        resolvedInitialStatus === 'ACTIVE'
          ? this.addDays(now, this.MANUAL_ACTIVE_DAYS)
          : this.addDays(now, this.MANUAL_TRIAL_DAYS);

      if (existing) {
        if (existing.planId === plan.id) {
          return existing;
        }

        return tx.subscription.update({
          where: { id: existing.id },
          data: {
            planId: plan.id,
            status: resolvedInitialStatus,
            startedAt: now,
            trialEndsAt:
              resolvedInitialStatus === 'TRIALING' ? nextPeriodEnd : null,
            currentPeriodStart: now,
            currentPeriodEnd: nextPeriodEnd,
            nextBillingAt: nextPeriodEnd,
          },
          include: { plan: true },
        });
      }

      return tx.subscription.create({
        data: {
          companyId,
          planId: plan.id,
          status: resolvedInitialStatus,
          startedAt: now,
          trialEndsAt:
            resolvedInitialStatus === 'TRIALING' ? nextPeriodEnd : null,
          currentPeriodStart: now,
          currentPeriodEnd: nextPeriodEnd,
          nextBillingAt: nextPeriodEnd,
        },
        include: { plan: true },
      });
    });
  }

  async createCheckoutForSubscription(
    subscriptionId: string,
    input: CreateSubscriptionCheckoutDto,
    companyId?: string,
  ) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: true,
        company: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException('Assinatura não encontrada.');
    }

    if (companyId && subscription.companyId !== companyId) {
      throw new BadRequestException('Assinatura não pertence à empresa informada.');
    }

    await this.assertPaymentWindowOpenForSubscription(subscription);

    const amountCents = Number(input.amountCents || subscription.plan.priceCents || 0);
    this.validateMinimumAmountOrThrow(amountCents);
    const description = input.description?.trim() || `Assinatura ${subscription.plan.name}`;
    const orderNsu = `sub_${subscription.id}_${Date.now()}`;
    const webhookUrl = this.resolveWebhookUrl(input.webhookUrl);
    const redirectUrl = this.resolveRedirectUrl(input.redirectUrl);

    const checkout = await this.infinitePayGateway.createCheckoutLink({
      amountCents,
      currency: subscription.plan.currency,
      description,
      orderNsu,
      redirectUrl,
      webhookUrl,
      customer: input.customer || this.buildInfinitePayCustomer(subscription.company),
    });

    const safeResponse =
      checkout.rawResponse === undefined
        ? null
        : (JSON.parse(JSON.stringify(checkout.rawResponse)) as Prisma.InputJsonValue);

    const payment = await this.prisma.payment.create({
      data: {
        gateway: BillingGateway.INFINITEPAY,
        status: PaymentStatus.PENDING,
        amountCents,
        currency: subscription.plan.currency,
        gatewayReference: checkout.gatewayReference,
        externalPaymentId: checkout.transactionNsu || null,
        invoiceUrl: checkout.receiptUrl || null,
        checkoutUrl: checkout.checkoutUrl,
        metadata: {
          provider: 'INFINITEPAY',
          order_nsu: checkout.gatewayReference,
          invoice_slug: checkout.invoiceSlug || null,
          transaction_nsu: checkout.transactionNsu || null,
          request: {
            handleSource: 'INFINITEPAY_HANDLE',
            amountCents,
            currency: subscription.plan.currency,
            description,
            order_nsu: orderNsu,
          },
          response: safeResponse,
        },
        companyId: subscription.companyId,
        subscriptionId: subscription.id,
      },
    });

    return {
      subscriptionId: subscription.id,
      paymentId: payment.id,
      gateway: payment.gateway,
      status: payment.status,
      amountCents: payment.amountCents,
      gatewayReference: payment.gatewayReference,
      transactionNsu: payment.externalPaymentId,
      checkoutUrl: payment.checkoutUrl,
    };
  }

  async createInitialPaymentForSubscription(
    subscriptionId: string,
    companyId?: string,
    targetPlanId?: string,
  ) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException('Assinatura não encontrada.');
    }

    if (companyId && subscription.companyId !== companyId) {
      throw new BadRequestException('Assinatura não pertence à empresa informada.');
    }

    await this.assertPaymentWindowOpenForSubscription(subscription);

    const targetPlan = targetPlanId
      ? await this.prisma.plan.findUnique({
          where: { id: targetPlanId },
          select: {
            id: true,
            code: true,
            name: true,
            priceCents: true,
            currency: true,
            interval: true,
            active: true,
          },
        })
      : null;

    if (targetPlanId && !targetPlan) {
      throw new NotFoundException('Plano não encontrado.');
    }

    if (targetPlan && !targetPlan.active) {
      throw new BadRequestException('Plano inativo não pode ser utilizado.');
    }

    const billingPlan = targetPlan || subscription.plan;
    const amountCents = Number(billingPlan.priceCents || 0);
    this.validateMinimumAmountOrThrow(amountCents);
    const dueDate = subscription.nextBillingAt ?? this.addDays(new Date(), 30);
    const orderNsu = `initial_sub_${subscription.id}_${Date.now()}`;
    const description = targetPlan
      ? `Alteração para o plano ${billingPlan.name}`
      : `Primeiro pagamento da assinatura ${billingPlan.name}`;
    const webhookUrl = this.resolveWebhookUrl();
    const redirectUrl = this.resolveRedirectUrl();

    const company = await this.prisma.company.findUnique({
      where: { id: subscription.companyId },
      select: { id: true, name: true, document: true },
    });

    const payment = await this.prisma.payment.create({
      data: {
        gateway: BillingGateway.INFINITEPAY,
        status: PaymentStatus.PENDING,
        amountCents,
        currency: billingPlan.currency,
        dueDate,
        companyId: subscription.companyId,
        subscriptionId: subscription.id,
        metadata: {
          provider: 'INFINITEPAY',
          type: 'INITIAL_SUBSCRIPTION_PAYMENT',
          ...(targetPlan
            ? {
                requestedPlanId: targetPlan.id,
                requestedPlanCode: targetPlan.code,
                requestedPlanName: targetPlan.name,
              }
            : {}),
          order_nsu: orderNsu,
          request: {
            amountCents,
            currency: billingPlan.currency,
            description,
            order_nsu: orderNsu,
          },
        },
      },
    });

    try {
      const checkout = await this.infinitePayGateway.createCheckoutLink({
        amountCents,
        currency: billingPlan.currency,
        description,
        orderNsu,
        redirectUrl,
        webhookUrl,
        customer: company ? this.buildInfinitePayCustomer(company) : undefined,
      });

      const safeResponse =
        checkout.rawResponse === undefined
          ? null
          : (JSON.parse(JSON.stringify(checkout.rawResponse)) as Prisma.InputJsonValue);

      const updatedPayment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          gatewayReference: checkout.gatewayReference,
          externalPaymentId: checkout.transactionNsu || null,
          invoiceUrl: checkout.receiptUrl || null,
          checkoutUrl: checkout.checkoutUrl,
          metadata: {
            ...(payment.metadata && typeof payment.metadata === 'object' ? payment.metadata : {}),
            order_nsu: checkout.gatewayReference,
            invoice_slug: checkout.invoiceSlug || null,
            transaction_nsu: checkout.transactionNsu || null,
            response: safeResponse,
          } as Prisma.InputJsonValue,
        },
      });

      return {
        paymentId: updatedPayment.id,
        subscriptionId: updatedPayment.subscriptionId,
        companyId: updatedPayment.companyId,
        amountCents: updatedPayment.amountCents,
        dueDate: updatedPayment.dueDate,
        checkoutUrl: updatedPayment.checkoutUrl,
      };
    } catch (error) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          metadata: {
            ...(payment.metadata && typeof payment.metadata === 'object' ? payment.metadata : {}),
            gatewayError: this.getErrorMessage(error),
          } as Prisma.InputJsonValue,
        },
      });
      throw error;
    }
  }

  async createInitialPaymentForCompany(companyId: string, targetPlanId?: string) {
    if (!companyId?.trim()) {
      throw new BadRequestException('companyId do usuário autenticado não informado.');
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: { companyId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    });

    if (!subscription) {
      throw new NotFoundException('Nenhuma assinatura encontrada para a empresa autenticada.');
    }

    return this.createInitialPaymentForSubscription(
      subscription.id,
      companyId,
      targetPlanId,
    );
  }

  async checkPaymentFallback(
    input: CheckPaymentInput,
    context: { companyId?: string; role?: string } = {},
  ) {
    const orderNsu = String(input.order_nsu || '').trim();
    const transactionNsu = String(input.transaction_nsu || '').trim();
    const slug = String(input.slug || '').trim();

    if (!orderNsu) {
      throw new BadRequestException('order_nsu Ã© obrigatÃ³rio.');
    }

    const paymentCheckPayload = await this.infinitePayGateway.checkPayment(
      {
        orderNsu,
        ...(transactionNsu ? { transactionNsu } : {}),
        ...(slug ? { slug } : {}),
      },
      { force: true },
    );

    if (!paymentCheckPayload) {
      return {
        confirmed: false,
        paymentStatus: 'PENDING',
        message: 'Pagamento em processamento.',
      };
    }

    const normalized = this.normalizeInfinitePayWebhookPayload(paymentCheckPayload);
    const effectiveOrderNsu = normalized.orderNsu || orderNsu;
    const effectiveTransactionNsu = normalized.transactionNsu || transactionNsu || undefined;
    const effectiveSlug = normalized.invoiceSlug || slug || undefined;
    const effectiveReceiptUrl = normalized.receiptUrl || undefined;
    const effectivePaidAt = normalized.paidAt || new Date();

    let payment = await this.prisma.payment.findFirst({
      where: {
        gateway: BillingGateway.INFINITEPAY,
        gatewayReference: effectiveOrderNsu,
      },
      include: {
        subscription: { include: { plan: true } },
      },
    });

    if (!payment && effectiveTransactionNsu) {
      payment = await this.prisma.payment.findFirst({
        where: {
          gateway: BillingGateway.INFINITEPAY,
          externalPaymentId: effectiveTransactionNsu,
        },
        include: {
          subscription: { include: { plan: true } },
        },
      });
    }

    if (!payment) {
      return {
        confirmed: false,
        paymentStatus: normalized.paymentStatus || 'PENDING',
        paymentFound: false,
        orderNsu: effectiveOrderNsu,
        transactionNsu: effectiveTransactionNsu,
        message: 'Pagamento ainda nÃ£o conciliado no sistema.',
      };
    }

    const callerCompanyId = String(context.companyId || '').trim();
    const callerRole = String(context.role || '').trim().toUpperCase();
    if (callerRole !== 'ADMIN' && callerCompanyId && payment.companyId !== callerCompanyId) {
      throw new ForbiddenException('Acesso negado para pagamento de outra empresa.');
    }

    if (!this.isWebhookPaymentConfirmed(normalized)) {
      return {
        confirmed: false,
        paymentId: payment.id,
        paymentStatus: payment.status,
        orderNsu: effectiveOrderNsu,
        transactionNsu: effectiveTransactionNsu,
        message: 'Pagamento em processamento.',
      };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const refreshed = await tx.payment.findUnique({
        where: { id: payment!.id },
        include: {
          subscription: {
            include: {
              plan: true,
            },
          },
        },
      });
      if (!refreshed) {
        throw new NotFoundException('Pagamento nÃ£o encontrado.');
      }

      const updatedPayment = await tx.payment.update({
        where: { id: refreshed.id },
        data: {
          status: PaymentStatus.PAID,
          paidAt: effectivePaidAt,
          gatewayReference: effectiveOrderNsu,
          ...(effectiveTransactionNsu
            ? { externalPaymentId: effectiveTransactionNsu }
            : {}),
          ...(effectiveReceiptUrl ? { invoiceUrl: effectiveReceiptUrl } : {}),
          metadata: {
            ...(refreshed.metadata && typeof refreshed.metadata === 'object'
              ? refreshed.metadata
              : {}),
            ...(effectiveSlug ? { invoice_slug: effectiveSlug } : {}),
            ...(effectiveTransactionNsu
              ? { transaction_nsu: effectiveTransactionNsu }
              : {}),
            payment_check_response: this.toInputJson(paymentCheckPayload),
          } as Prisma.InputJsonValue,
        },
      });

      const requestedPlan = await this.resolveRequestedPlanForPayment(
        tx,
        refreshed.metadata,
        refreshed.subscription.plan,
      );
      const periodStart = effectivePaidAt;
      const periodEnd = this.computePeriodEnd(periodStart, requestedPlan.interval);
      await tx.subscription.update({
        where: { id: refreshed.subscriptionId },
        data: {
          planId: requestedPlan.id,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          nextBillingAt: periodEnd,
        },
      });

      return updatedPayment;
    });

    return {
      confirmed: true,
      paymentId: result.id,
      paymentStatus: result.status,
      orderNsu: effectiveOrderNsu,
      transactionNsu: effectiveTransactionNsu,
      receiptUrl: effectiveReceiptUrl,
      message: 'Pagamento confirmado com sucesso.',
    };
  }

  async cancelCompanySubscription(companyId: string) {
    if (!companyId?.trim()) {
      throw new BadRequestException('companyId é obrigatório.');
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: { companyId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      include: { plan: true },
    });

    if (!subscription) {
      throw new NotFoundException('Nenhuma assinatura encontrada para a empresa.');
    }

    const now = new Date();
    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.CANCELED,
        currentPeriodEnd: now,
        nextBillingAt: now,
      },
      include: { plan: true },
    });

    return {
      id: updated.id,
      companyId: updated.companyId,
      status: updated.status,
      currentPeriodStart: updated.currentPeriodStart,
      currentPeriodEnd: updated.currentPeriodEnd,
      nextBillingAt: updated.nextBillingAt,
      plan: {
        id: updated.plan.id,
        code: updated.plan.code,
        name: updated.plan.name,
        priceCents: updated.plan.priceCents,
        currency: updated.plan.currency,
        interval: updated.plan.interval,
      },
    };
  }

  async activateCompanySubscription(companyId: string) {
    if (!companyId?.trim()) {
      throw new BadRequestException('companyId é obrigatório.');
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: { companyId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      include: { plan: true },
    });

    if (!subscription) {
      throw new NotFoundException('Nenhuma assinatura encontrada para a empresa.');
    }

    const now = new Date();
    const periodEnd = this.computePeriodEnd(now, subscription.plan.interval);
    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextBillingAt: periodEnd,
        canceledAt: null,
      },
      include: { plan: true },
    });

    return {
      id: updated.id,
      companyId: updated.companyId,
      status: updated.status,
      currentPeriodStart: updated.currentPeriodStart,
      currentPeriodEnd: updated.currentPeriodEnd,
      nextBillingAt: updated.nextBillingAt,
      plan: {
        id: updated.plan.id,
        code: updated.plan.code,
        name: updated.plan.name,
        priceCents: updated.plan.priceCents,
        currency: updated.plan.currency,
        interval: updated.plan.interval,
      },
    };
  }

  async handleInfinitePayWebhook(payload: unknown, headers?: Record<string, string | string[]>) {
    const normalized = this.normalizeInfinitePayWebhookPayload(payload, headers);
    this.logWebhook('[InfinitePay webhook] payload normalizado', {
      dedupKey: normalized.dedupKey,
      eventType: normalized.eventType,
      paymentStatus: normalized.paymentStatus,
      amount: normalized.amount,
      paidAmount: normalized.paidAmount,
      orderNsu: normalized.orderNsu,
      transactionNsu: normalized.transactionNsu,
      invoiceSlug: normalized.invoiceSlug,
      receiptUrl: normalized.receiptUrl,
      subscriptionIdHint: normalized.subscriptionIdHint,
      companyIdHint: normalized.companyIdHint,
      paymentCheckEnabled: normalized.paymentCheckEnabled,
    });
    this.logWebhook('[InfinitePay webhook] order_nsu extraido', normalized.orderNsu || null);
    this.logWebhook(
      '[InfinitePay webhook] transaction_nsu extraido',
      normalized.transactionNsu || null,
    );
    const companyIdForEvent = await this.resolveWebhookCompanyId(normalized);
    this.logWebhook('[InfinitePay webhook] companyId resolvido', companyIdForEvent || '(none)');

    let webhookEvent: { id: string } | null = null;
    try {
      webhookEvent = await this.prisma.webhookEvent.create({
        data: {
          gateway: BillingGateway.INFINITEPAY,
          eventType: normalized.eventType,
          externalEventId: normalized.dedupKey,
          payload: this.toInputJson(normalized.rawPayload),
          processStatus: WebhookProcessStatus.PENDING,
          ...(companyIdForEvent ? { companyId: companyIdForEvent } : {}),
        },
        select: { id: true },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        return {
          duplicate: true,
          message: 'Evento duplicado ignorado com segurança.',
        };
      }
      throw error;
    }

    if (!this.isWebhookPaymentConfirmed(normalized) && normalized.paymentCheckEnabled && normalized.orderNsu) {
      this.logWebhook(
        '[InfinitePay webhook] payment_check habilitado consultando order_nsu',
        normalized.orderNsu,
      );
      const paymentCheckPayload = await this.infinitePayGateway.checkPayment({
        orderNsu: normalized.orderNsu,
      });
      const paymentCheckStatus = this.extractPaymentCheckStatus(paymentCheckPayload);
      if (paymentCheckStatus) {
        this.logWebhook('[InfinitePay webhook] payment_check status', paymentCheckStatus);
        normalized.paymentStatus = paymentCheckStatus;
      }
      const normalizedFromPaymentCheck = this.normalizeInfinitePayWebhookPayload(paymentCheckPayload || {});
      normalized.amount = normalized.amount ?? normalizedFromPaymentCheck.amount;
      normalized.paidAmount = normalized.paidAmount ?? normalizedFromPaymentCheck.paidAmount;
      normalized.receiptUrl = normalized.receiptUrl || normalizedFromPaymentCheck.receiptUrl;
      normalized.transactionNsu =
        normalized.transactionNsu || normalizedFromPaymentCheck.transactionNsu;
      normalized.invoiceSlug = normalized.invoiceSlug || normalizedFromPaymentCheck.invoiceSlug;
    }

    if (!this.isWebhookPaymentConfirmed(normalized)) {
      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          processStatus: WebhookProcessStatus.PROCESSED,
          processedAt: new Date(),
          ...(companyIdForEvent ? { companyId: companyIdForEvent } : {}),
        },
      });
      return {
        duplicate: false,
        processed: true,
        message: `Evento ${normalized.eventType} sem confirmação de pagamento.`,
      };
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const payment = await this.findPaymentByWebhookReference(tx, normalized);
        if (!payment) {
          throw new NotFoundException('Pagamento não encontrado para o webhook recebido.');
        }
        this.logWebhook('[InfinitePay webhook] lookup do Payment encontrado', {
          paymentId: payment.id,
          companyId: payment.companyId,
          subscriptionId: payment.subscriptionId,
          gatewayReference: payment.gatewayReference,
          statusAtual: payment.status,
        });

        const paidAt = normalized.paidAt ?? new Date();

        const updatedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.PAID,
            paidAt,
            ...(normalized.transactionNsu
              ? { externalPaymentId: normalized.transactionNsu }
              : {}),
            ...(normalized.orderNsu
              ? { gatewayReference: normalized.orderNsu }
              : {}),
            ...(normalized.receiptUrl ? { invoiceUrl: normalized.receiptUrl } : {}),
            metadata: {
              ...(payment.metadata && typeof payment.metadata === 'object'
                ? payment.metadata
                : {}),
              ...(normalized.invoiceSlug ? { invoice_slug: normalized.invoiceSlug } : {}),
              ...(normalized.transactionNsu
                ? { transaction_nsu: normalized.transactionNsu }
                : {}),
            } as Prisma.InputJsonValue,
          },
          include: {
            subscription: {
              include: {
                plan: true,
              },
            },
          },
        });

        const requestedPlan = await this.resolveRequestedPlanForPayment(
          tx,
          payment.metadata,
          updatedPayment.subscription.plan,
        );
        const periodStart = normalized.periodStart ?? paidAt;
        const periodEnd =
          normalized.periodEnd ??
          this.computePeriodEnd(periodStart, requestedPlan.interval);

        const updatedSubscription = await tx.subscription.update({
          where: { id: updatedPayment.subscriptionId },
          data: {
            planId: requestedPlan.id,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            nextBillingAt: periodEnd,
          },
        });

        this.logWebhook('[InfinitePay webhook] atualizacao Payment/Subscription concluida', {
          paymentId: updatedPayment.id,
          paymentStatus: updatedPayment.status,
          subscriptionId: updatedSubscription.id,
          subscriptionStatus: updatedSubscription.status,
        });

        await tx.webhookEvent.update({
          where: { id: webhookEvent!.id },
          data: {
            companyId: updatedPayment.companyId,
            subscriptionId: updatedPayment.subscriptionId,
            processStatus: WebhookProcessStatus.PROCESSED,
            processedAt: new Date(),
          },
        });

        return {
          paymentId: updatedPayment.id,
          subscriptionId: updatedSubscription.id,
        };
      });

      return {
        duplicate: false,
        processed: true,
        ...result,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        this.logWebhook(
          '[InfinitePay webhook] pagamento nao encontrado durante conciliacao',
          this.getErrorMessage(error),
          true,
        );
        await this.prisma.webhookEvent.update({
          where: { id: webhookEvent.id },
          data: {
            processStatus: WebhookProcessStatus.PROCESSED,
            processedAt: new Date(),
            errorMessage: this.getErrorMessage(error),
            ...(companyIdForEvent ? { companyId: companyIdForEvent } : {}),
          },
        });
        return {
          duplicate: false,
          processed: true,
          message: 'Webhook recebido com sucesso, aguardando conciliacao do pagamento.',
        };
      }
      this.logWebhook('[InfinitePay webhook] falha no processamento', this.getErrorMessage(error), true);
      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          processStatus: WebhookProcessStatus.FAILED,
          errorMessage: this.getErrorMessage(error),
        },
      });
      throw new InternalServerErrorException('Falha ao processar webhook de billing.');
    }
  }

  private normalizeInfinitePayWebhookPayload(
    payload: unknown,
    headers?: Record<string, string | string[]>,
  ): InfinitePayWebhookNormalized {
    const body = this.asObject(payload);
    const headerEventId = this.readHeader(headers, 'x-event-id');
    const eventId =
      this.readString(body.eventId) ||
      this.readString(body.event_id) ||
      this.readString(body.id) ||
      headerEventId;

    const eventType =
      this.readString(body.type) ||
      this.readString(body.event) ||
      this.readString(body.eventType) ||
      'UNKNOWN';

    const paidBoolean = this.readBoolean(
      body.paid ??
        this.asObject(body.data).paid ??
        this.asObject(body.payment).paid ??
        this.asObject(body.payment_check).paid ??
        body.is_paid ??
        this.asObject(body.data).is_paid,
    );

    const paymentStatus =
      this.readString(body.status) ||
      this.readString(body.paymentStatus) ||
      this.readString(body.capture_method) ||
      this.readString(this.asObject(body.data).status) ||
      this.readString(this.asObject(body.payment).status) ||
      this.readString(this.asObject(body.payment_check).status) ||
      (paidBoolean ? 'PAID' : '') ||
      '';

    const amount = this.readNumber(
      body.amount ??
        this.asObject(body.data).amount ??
        this.asObject(body.payment).amount ??
        this.asObject(body.payment_check).amount,
    );
    const paidAmount = this.readNumber(
      body.paid_amount ??
        body.paidAmount ??
        this.asObject(body.data).paid_amount ??
        this.asObject(body.data).paidAmount ??
        this.asObject(body.payment).paid_amount ??
        this.asObject(body.payment).paidAmount ??
        this.asObject(body.payment_check).paid_amount,
    );

    const orderNsu =
      this.readString(body.order_nsu) ||
      this.readString(this.asObject(body.data).order_nsu) ||
      this.readString(this.asObject(body.payment).order_nsu) ||
      this.readString(this.asObject(body.metadata).order_nsu) ||
      this.readString(this.asObject(body.data).reference) ||
      this.readString(this.asObject(body.payment).reference) ||
      this.readString(body.reference);

    const transactionNsu =
      this.readString(body.transaction_nsu) ||
      this.readString(this.asObject(body.data).transaction_nsu) ||
      this.readString(this.asObject(body.payment).transaction_nsu) ||
      this.readString(this.asObject(body.data).paymentId) ||
      this.readString(this.asObject(body.payment).id) ||
      this.readString(body.paymentId);

    const invoiceSlug =
      this.readString(body.invoice_slug) ||
      this.readString(this.asObject(body.data).invoice_slug) ||
      this.readString(this.asObject(body.metadata).invoice_slug);

    const receiptUrl =
      this.readString(body.receipt_url) ||
      this.readString(this.asObject(body.data).receipt_url) ||
      this.readString(this.asObject(body.payment).receipt_url);

    const subscriptionIdHint =
      this.readString(this.asObject(body.metadata).subscriptionId) ||
      this.readString(body.subscriptionId);

    const companyIdHint =
      this.readString(this.asObject(body.metadata).companyId) ||
      this.readString(body.companyId) ||
      this.readString(this.asObject(body.company).id);

    const paidAt = this.readDate(
      this.readString(body.paid_at) ||
        this.readString(body.paidAt) ||
        this.readString(this.asObject(body.data).paid_at) ||
        this.readString(this.asObject(body.data).paidAt) ||
        this.readString(this.asObject(body.payment).paidAt) ||
        this.readString(body.paidAt),
    );

    const periodStart = this.readDate(
      this.readString(this.asObject(body.data).periodStart) ||
        this.readString(this.asObject(body.data).currentPeriodStart),
    );
    const periodEnd = this.readDate(
      this.readString(this.asObject(body.data).periodEnd) ||
        this.readString(this.asObject(body.data).currentPeriodEnd),
    );

    const dedupKey = eventId || this.hashPayload(body);
    const paymentCheckEnabled = this.readBoolean(
      body.payment_check ||
        this.asObject(body.payment_check).enabled ||
        this.asObject(body.metadata).payment_check,
    );

    return {
      dedupKey,
      eventType,
      paymentStatus,
      amount,
      paidAmount,
      orderNsu,
      transactionNsu,
      invoiceSlug,
      receiptUrl,
      subscriptionIdHint,
      companyIdHint,
      paidAt,
      periodStart,
      periodEnd,
      paymentCheckEnabled,
      rawPayload: body,
    };
  }

  private async resolveWebhookCompanyId(normalized: InfinitePayWebhookNormalized) {
    if (normalized.companyIdHint) return normalized.companyIdHint;

    if (normalized.subscriptionIdHint) {
      const subscription = await this.prisma.subscription.findUnique({
        where: { id: normalized.subscriptionIdHint },
        select: { companyId: true },
      });
      if (subscription?.companyId) return subscription.companyId;
    }

    if (normalized.orderNsu) {
      const payment = await this.prisma.payment.findFirst({
        where: { gateway: BillingGateway.INFINITEPAY, gatewayReference: normalized.orderNsu },
        select: { companyId: true },
      });
      if (payment?.companyId) return payment.companyId;
    }

    if (normalized.transactionNsu) {
      const payment = await this.prisma.payment.findFirst({
        where: { gateway: BillingGateway.INFINITEPAY, externalPaymentId: normalized.transactionNsu },
        select: { companyId: true },
      });
      if (payment?.companyId) return payment.companyId;
    }

    return undefined;
  }

  private async findPaymentByWebhookReference(
    tx: Prisma.TransactionClient,
    normalized: InfinitePayWebhookNormalized,
  ) {
    if (normalized.orderNsu) {
      this.logWebhook('[InfinitePay webhook] lookup por order_nsu', normalized.orderNsu);
      const byOrderNsu = await tx.payment.findFirst({
        where: {
          gateway: BillingGateway.INFINITEPAY,
          gatewayReference: normalized.orderNsu,
        },
      });
      if (byOrderNsu) {
        this.logWebhook('[InfinitePay webhook] lookup por order_nsu encontrou payment', byOrderNsu.id);
        return byOrderNsu;
      }
    }

    if (normalized.transactionNsu) {
      this.logWebhook(
        '[InfinitePay webhook] lookup por transaction_nsu',
        normalized.transactionNsu,
      );
      const byTransactionNsu = await tx.payment.findFirst({
        where: {
          gateway: BillingGateway.INFINITEPAY,
          externalPaymentId: normalized.transactionNsu,
        },
      });
      if (byTransactionNsu) {
        this.logWebhook(
          '[InfinitePay webhook] lookup por transaction_nsu encontrou payment',
          byTransactionNsu.id,
        );
        return byTransactionNsu;
      }
    }

    if (normalized.subscriptionIdHint) {
      return tx.payment.findFirst({
        where: {
          gateway: BillingGateway.INFINITEPAY,
          subscriptionId: normalized.subscriptionIdHint,
          status: PaymentStatus.PENDING,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return null;
  }

  private computePeriodEnd(periodStart: Date, interval: PlanInterval) {
    const end = new Date(periodStart);
    if (interval === PlanInterval.YEARLY) {
      end.setFullYear(end.getFullYear() + 1);
      return end;
    }
    end.setMonth(end.getMonth() + 1);
    return end;
  }

  private isPaymentConfirmedStatus(status: string) {
    const normalized = String(status || '').trim().toUpperCase();
    return ['PAID', 'APPROVED', 'CONFIRMED', 'SUCCEEDED', 'SUCCESS'].includes(normalized);
  }

  private isWebhookPaymentConfirmed(normalized: InfinitePayWebhookNormalized) {
    if (this.isPaymentConfirmedStatus(normalized.paymentStatus)) return true;

    const hasTransactionNsu = Boolean(String(normalized.transactionNsu || '').trim());
    const hasReceiptUrl = Boolean(String(normalized.receiptUrl || '').trim());
    const amount = Number(normalized.amount || 0);
    const paidAmount = Number(normalized.paidAmount || 0);
    const paidByAmounts = Number.isFinite(amount) && amount > 0 && paidAmount >= amount;

    if (hasTransactionNsu && hasReceiptUrl && paidByAmounts) {
      this.logWebhook('[InfinitePay webhook] confirmado por amount/paid_amount + comprovante', {
        orderNsu: normalized.orderNsu,
        transactionNsu: normalized.transactionNsu,
        amount,
        paidAmount,
      });
      return true;
    }

    return false;
  }

  private extractPaymentCheckStatus(payload: unknown) {
    const body = this.asObject(payload);
    const paid = this.readBoolean(
      body.paid ??
        this.asObject(body.data).paid ??
        this.asObject(body.payment).paid ??
        this.asObject(body.payment_check).paid,
    );
    if (paid) return 'PAID';
    return (
      this.readString(body.status) ||
      this.readString(this.asObject(body.data).status) ||
      this.readString(this.asObject(body.payment).status) ||
      ''
    );
  }

  private buildInfinitePayCustomer(company?: {
    name?: string | null;
    document?: string | null;
  }) {
    if (!company) return undefined;
    return {
      name: company.name || undefined,
      document: company.document || undefined,
    };
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }

  private readHeader(headers: Record<string, string | string[]> | undefined, key: string) {
    if (!headers) return '';
    const value = headers[key] ?? headers[key.toLowerCase()] ?? headers[key.toUpperCase()];
    if (Array.isArray(value)) return String(value[0] || '').trim();
    return String(value || '').trim();
  }

  private readDate(value?: string) {
    if (!value) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed;
  }

  private readString(value: unknown) {
    if (typeof value !== 'string') return '';
    return value.trim();
  }

  private readBoolean(value: unknown) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value !== 'string') return false;
    const normalized = value.trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(normalized);
  }

  private readNumber(value: unknown) {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : undefined;
    }
    if (typeof value === 'string') {
      const raw = value.trim();
      const normalized = raw.includes(',')
        ? raw.replace(/\./g, '').replace(',', '.')
        : raw;
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }

  private asObject(value: unknown): Record<string, any> {
    if (!value || typeof value !== 'object') return {};
    return value as Record<string, any>;
  }

  private hashPayload(payload: unknown) {
    const raw = JSON.stringify(payload || {});
    return `hash_${createHash('sha256').update(raw).digest('hex')}`;
  }

  private addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private getErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    return 'Erro desconhecido ao processar webhook.';
  }

  private async assertPaymentWindowOpenForSubscription(subscription: {
    id: string;
    status?: SubscriptionStatus | null;
    currentPeriodStart?: Date | null;
    nextBillingAt?: Date | null;
  }) {
    if (
      subscription.status === SubscriptionStatus.CANCELED ||
      subscription.status === SubscriptionStatus.PAST_DUE
    ) {
      return;
    }

    const nextBillingAt = subscription.nextBillingAt
      ? new Date(subscription.nextBillingAt)
      : null;
    if (!nextBillingAt || Number.isNaN(nextBillingAt.getTime())) return;

    const unlockDaysBeforeDue = this.getPaymentUnlockDaysBeforeDue();
    const unlockDate = new Date(nextBillingAt);
    unlockDate.setDate(unlockDate.getDate() - unlockDaysBeforeDue);

    const now = new Date();
    if (now >= unlockDate) return;

    const paidPayment = await this.prisma.payment.findFirst({
      where: {
        subscriptionId: subscription.id,
        status: PaymentStatus.PAID,
        ...(subscription.currentPeriodStart
          ? { paidAt: { gte: subscription.currentPeriodStart } }
          : {}),
      },
      orderBy: [{ paidAt: 'desc' }, { updatedAt: 'desc' }],
      select: { id: true },
    });

    if (!paidPayment) return;

    const releaseDate = unlockDate.toLocaleDateString('pt-BR');
    throw new BadRequestException(
      `Pagamento deste ciclo já foi confirmado. Nova cobrança será liberada a partir de ${releaseDate}.`,
    );
  }

  private getPaymentUnlockDaysBeforeDue() {
    const raw = Number(
      this.configService?.get<string>('BILLING_PAYMENT_UNLOCK_DAYS_BEFORE_DUE') ??
        process.env.BILLING_PAYMENT_UNLOCK_DAYS_BEFORE_DUE ??
        5,
    );
    if (!Number.isFinite(raw) || raw < 0) return 5;
    return Math.floor(raw);
  }

  private toInputJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
  }

  private validateMinimumAmountOrThrow(amountCents: number) {
    if (!Number.isFinite(amountCents) || amountCents < this.getMinAmountCents()) {
      throw new BadRequestException(this.getMinAmountErrorMessage());
    }
  }

  private getMinAmountCents() {
    const raw = Number(process.env.INFINITEPAY_MIN_AMOUNT_CENTS ?? 100);
    if (!Number.isFinite(raw) || raw <= 0) return 100;
    return Math.floor(raw);
  }

  private getMinAmountErrorMessage() {
    const min = this.getMinAmountCents();
    const value = (min / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    });
    return `Valor mínimo para pagamento é ${value}`;
  }
  private resolveWebhookUrl(explicitWebhookUrl?: string) {
    const explicit = String(explicitWebhookUrl || '').trim();
    if (explicit) {
      this.assertWebhookUrlIsPublic(explicit);
      return explicit;
    }

    const configured = String(
      this.configService?.get<string>('INFINITEPAY_WEBHOOK_URL') ||
        this.configService?.get<string>('BACKEND_PUBLIC_URL') ||
        '',
    ).trim();
    if (!configured) return undefined;

    const normalizedBase = configured.replace(/\/+$/, '');
    const webhookUrl = `${normalizedBase}/billing/webhooks/infinitepay`;
    this.assertWebhookUrlIsPublic(webhookUrl);
    return webhookUrl;
  }

  private resolveRedirectUrl(explicitRedirectUrl?: string) {
    const explicit = String(explicitRedirectUrl || '').trim();
    if (explicit) {
      this.assertRedirectUrlIsPublic(explicit);
      return explicit;
    }

    const configuredRedirect = String(
      this.configService?.get<string>('INFINITEPAY_REDIRECT_URL') || '',
    ).trim();
    if (configuredRedirect) {
      this.assertRedirectUrlIsPublic(configuredRedirect);
      return configuredRedirect;
    }

    const frontendBase = String(
      this.configService?.get<string>('FRONTEND_PUBLIC_URL') ||
        this.extractFirstCorsOrigin(this.configService?.get<string>('CORS_ORIGINS')) ||
        '',
    ).trim();
    if (!frontendBase) return undefined;

    const redirectUrl = `${frontendBase.replace(/\/+$/, '')}/billing/success`;
    this.assertRedirectUrlIsPublic(redirectUrl);
    return redirectUrl;
  }

  private extractFirstCorsOrigin(value?: string) {
    if (!value) return '';
    return (
      value
        .split(',')
        .map((origin) => origin.trim())
        .find(Boolean) || ''
    );
  }

  private assertRedirectUrlIsPublic(redirectUrl: string) {
    let parsed: URL;
    try {
      parsed = new URL(redirectUrl.trim());
    } catch {
      throw new BadRequestException('redirect_url invÃ¡lida. Informe uma URL HTTPS pÃºblica.');
    }

    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== 'https:') {
      throw new BadRequestException('redirect_url invÃ¡lida. A URL deve usar HTTPS.');
    }
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
      throw new BadRequestException(
        'redirect_url invÃ¡lida para produÃ§Ã£o. Configure uma URL pÃºblica do frontend.',
      );
    }
  }

  private assertWebhookUrlIsPublic(webhookUrl: string) {
    const normalized = webhookUrl.trim().toLowerCase();
    if (
      normalized.includes('localhost') ||
      normalized.includes('127.0.0.1') ||
      normalized.includes('0.0.0.0')
    ) {
      throw new BadRequestException(
        'webhook_url inválida para produção. Configure uma URL pública do backend.',
      );
    }
  }

  private async resolveSubscriptionInitialStatus(
    tx: Prisma.TransactionClient,
    companyId: string,
    plan: {
      id: string;
      code?: string | null;
      name?: string | null;
      interval: PlanInterval;
    },
    requestedInitialStatus: CompanySubscriptionInitialStatus | undefined,
    currentSubscriptionId: string | undefined,
    now: Date,
  ): Promise<CompanySubscriptionInitialStatus> {
    if (requestedInitialStatus === 'ACTIVE') {
      return 'ACTIVE';
    }

    const trialAllowed = await this.canStartTrialForPlan(
      tx,
      companyId,
      plan,
      currentSubscriptionId,
      now,
    );

    if (requestedInitialStatus === 'TRIALING' && !trialAllowed) {
      throw new BadRequestException(
        'PerÃ­odo de teste disponÃ­vel apenas para o plano Starter na primeira contrataÃ§Ã£o. Para continuar, selecione o plano com pagamento.',
      );
    }

    return trialAllowed ? 'TRIALING' : 'ACTIVE';
  }

  private async canStartTrialForPlan(
    tx: Prisma.TransactionClient,
    companyId: string,
    plan: { code?: string | null; name?: string | null },
    currentSubscriptionId: string | undefined,
    now: Date,
  ) {
    if (!this.isStarterPlan(plan)) {
      return false;
    }

    const previousTrials = await tx.subscription.findMany({
      where: {
        companyId,
        trialEndsAt: { not: null },
        ...(currentSubscriptionId ? { id: { not: currentSubscriptionId } } : {}),
      },
      select: {
        id: true,
        trialEndsAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (previousTrials.length === 0) {
      return true;
    }

    return previousTrials.every((subscription) => {
      if (!subscription.trialEndsAt) return false;
      return subscription.trialEndsAt.getTime() > now.getTime();
    });
  }

  private isStarterPlan(plan: { code?: string | null; name?: string | null }) {
    const code = String(plan.code || '').trim().toUpperCase();
    const name = String(plan.name || '').trim().toUpperCase();

    return code === 'STA' || code === 'STARTER' || name.includes('STARTER');
  }

  private async resolveRequestedPlanForPayment(
    tx: Prisma.TransactionClient,
    metadata: Prisma.JsonValue | null,
    fallbackPlan: {
      id: string;
      code?: string | null;
      name?: string | null;
      priceCents: number;
      currency: string;
      interval: PlanInterval;
    },
  ) {
    const rawPlanId =
      metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? String((metadata as Record<string, unknown>).requestedPlanId || '').trim()
        : '';

    if (!rawPlanId) {
      return fallbackPlan;
    }

    const requestedPlan = await tx.plan.findUnique({
      where: { id: rawPlanId },
      select: {
        id: true,
        code: true,
        name: true,
        priceCents: true,
        currency: true,
        interval: true,
        active: true,
      },
    });

    if (!requestedPlan || !requestedPlan.active) {
      return fallbackPlan;
    }

    return requestedPlan;
  }


  private mapPlanSummary(plan: {
    id: string;
    code: string;
    name: string;
    description?: string | null;
    priceCents: number;
    vehicleLimit?: number | null;
    currency: string;
    interval: PlanInterval;
    active: boolean;
    isPublic: boolean;
    isEnterprise: boolean;
    createdAt: Date;
    updatedAt?: Date;
    companyId?: string | null;
    company?: { id: string; name: string } | null;
  }) {
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description ?? null,
      priceCents: plan.priceCents,
      vehicleLimit: plan.vehicleLimit ?? null,
      currency: plan.currency,
      interval: plan.interval,
      active: plan.active,
      isPublic: plan.isPublic,
      isEnterprise: plan.isEnterprise,
      companyId: plan.companyId ?? null,
      company: plan.company ?? null,
      createdAt: plan.createdAt,
      ...(plan.updatedAt ? { updatedAt: plan.updatedAt } : {}),
    };
  }

  private resolvePlanVisibility(isPublic?: boolean, isEnterprise?: boolean) {
    const resolvedIsPublic = isPublic ?? !isEnterprise;
    const resolvedIsEnterprise = isEnterprise ?? !resolvedIsPublic;

    if (resolvedIsPublic === resolvedIsEnterprise) {
      throw new BadRequestException(
        'Plano deve ser público ou enterprise, mas não ambos.',
      );
    }

    return {
      isPublic: resolvedIsPublic,
      isEnterprise: resolvedIsEnterprise,
    };
  }

  private async validatePlanCompanyAssignment(input: {
    companyId: string | null;
    isPublic: boolean;
    isEnterprise: boolean;
  }) {
    if (input.isEnterprise && !input.companyId) {
      throw new BadRequestException(
        'Plano enterprise deve possuir companyId.',
      );
    }

    if (input.isPublic && input.companyId) {
      throw new BadRequestException(
        'Plano público não pode possuir companyId.',
      );
    }

    if (!input.companyId) {
      return;
    }

    const company = await this.prisma.company.findUnique({
      where: { id: input.companyId },
      select: { id: true },
    });

    if (!company) {
      throw new NotFoundException('Empresa do plano não encontrada.');
    }
  }

  private assertPlanAvailabilityForCompany(
    companyId: string,
    plan: {
      id: string;
      isPublic?: boolean | null;
      isEnterprise?: boolean | null;
      companyId?: string | null;
    },
  ) {
    if (plan.isEnterprise) {
      if (!plan.companyId || plan.companyId !== companyId) {
        throw new ForbiddenException(
          'Plano enterprise não está disponível para esta empresa.',
        );
      }
      return;
    }

    if (!plan.isPublic) {
      throw new ForbiddenException('Plano indisponível para esta empresa.');
    }
  }

  private logWebhook(message: string, payload?: unknown, isError = false) {
    void message;
    void payload;
    void isError;
  }
}
