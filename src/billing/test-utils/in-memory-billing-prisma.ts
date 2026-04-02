type Company = {
  id: string;
  name: string;
  active: boolean;
};

type Plan = {
  id: string;
  code: string;
  name: string;
  priceCents: number;
  currency: string;
  interval: 'MONTHLY' | 'YEARLY';
  isActive: boolean;
};

type Subscription = {
  id: string;
  companyId: string;
  planId: string;
  status: string;
  startedAt: Date | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  nextBillingAt: Date | null;
  trialEndsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type Payment = {
  id: string;
  companyId: string;
  subscriptionId: string;
  gateway: string;
  status: string;
  amountCents: number;
  currency: string;
  dueDate: Date | null;
  paidAt: Date | null;
  gatewayReference: string | null;
  checkoutUrl: string | null;
  externalPaymentId: string | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
};

type WebhookEvent = {
  id: string;
  gateway: string;
  eventType: string;
  externalEventId: string | null;
  payload: any;
  processStatus: string;
  processedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  companyId: string | null;
  subscriptionId: string | null;
};

export type BillingState = {
  companies: Company[];
  plans: Plan[];
  subscriptions: Subscription[];
  payments: Payment[];
  webhookEvents: WebhookEvent[];
};

let subscriptionSeq = 1;
let paymentSeq = 1;
let webhookSeq = 1;

const nowDate = () => new Date();

const clone = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

export function createInMemoryBillingPrisma(initial?: Partial<BillingState>) {
  const state: BillingState = {
    companies: initial?.companies ? clone(initial.companies) : [],
    plans: initial?.plans ? clone(initial.plans) : [],
    subscriptions: initial?.subscriptions ? clone(initial.subscriptions) : [],
    payments: initial?.payments ? clone(initial.payments) : [],
    webhookEvents: initial?.webhookEvents ? clone(initial.webhookEvents) : [],
  };

  const withPlan = (subscription: Subscription) => {
    const plan = state.plans.find((item) => item.id === subscription.planId);
    return { ...subscription, plan: plan || null };
  };

  const withCompany = (subscription: Subscription) => {
    const company = state.companies.find((item) => item.id === subscription.companyId);
    return { ...subscription, company: company || null };
  };

  const subscriptionFindFirstImpl = async (args: any) => {
    const where = args?.where || {};
    let list = [...state.subscriptions];

    if (where.companyId) {
      list = list.filter((item) => item.companyId === where.companyId);
    }
    if (where.status?.in) {
      const statuses = where.status.in as string[];
      list = list.filter((item) => statuses.includes(item.status));
    }

    list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const found = list[0];
    if (!found) return null;
    if (args?.include?.plan) return withPlan(found);
    return found;
  };

  const paymentFindFirstImpl = async (args: any) => {
    const where = args?.where || {};
    let list = [...state.payments];

    if (where.gateway) list = list.filter((item) => item.gateway === where.gateway);
    if (where.gatewayReference)
      list = list.filter((item) => item.gatewayReference === where.gatewayReference);
    if (where.externalPaymentId)
      list = list.filter((item) => item.externalPaymentId === where.externalPaymentId);
    if (where.subscriptionId) list = list.filter((item) => item.subscriptionId === where.subscriptionId);
    if (where.status) list = list.filter((item) => item.status === where.status);

    list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return list[0] || null;
  };

  const prisma: any = {
    company: {
      findUnique: jest.fn(async (args: any) => {
        const id = args?.where?.id;
        return state.companies.find((item) => item.id === id) || null;
      }),
    },
    plan: {
      findUnique: jest.fn(async (args: any) => {
        const id = args?.where?.id;
        return state.plans.find((item) => item.id === id) || null;
      }),
      findMany: jest.fn(async () => [...state.plans]),
    },
    subscription: {
      findFirst: jest.fn(subscriptionFindFirstImpl),
      findUnique: jest.fn(async (args: any) => {
        const id = args?.where?.id;
        const found = state.subscriptions.find((item) => item.id === id) || null;
        if (!found) return null;
        if (args?.include?.plan && args?.include?.company) {
          return withCompany(withPlan(found) as any);
        }
        if (args?.include?.plan) return withPlan(found);
        if (args?.select?.companyId) return { companyId: found.companyId };
        return found;
      }),
      create: jest.fn(async (args: any) => {
        const data = args.data;
        const now = nowDate();
        const created: Subscription = {
          id: data.id || `sub_${subscriptionSeq++}`,
          companyId: data.companyId,
          planId: data.planId,
          status: data.status,
          startedAt: data.startedAt || null,
          currentPeriodStart: data.currentPeriodStart || null,
          currentPeriodEnd: data.currentPeriodEnd || null,
          nextBillingAt: data.nextBillingAt || null,
          trialEndsAt: data.trialEndsAt || null,
          createdAt: now,
          updatedAt: now,
        };
        state.subscriptions.push(created);
        if (args?.include?.plan) return withPlan(created);
        return created;
      }),
      findMany: jest.fn(async (args: any) => {
        const where = args?.where || {};
        let list = [...state.subscriptions];
        if (where.companyId) {
          list = list.filter((item) => item.companyId === where.companyId);
        }
        if (where.trialEndsAt?.not === null) {
          list = list.filter((item) => item.trialEndsAt !== null);
        }
        if (where.trialEndsAt?.lt) {
          list = list.filter(
            (item) => item.trialEndsAt && item.trialEndsAt < where.trialEndsAt.lt,
          );
        }
        if (where.id?.not) {
          list = list.filter((item) => item.id !== where.id.not);
        }
        if (args?.orderBy?.createdAt === 'asc') {
          list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        }
        if (args?.select?.id || args?.select?.trialEndsAt) {
          return list.map((item) => ({
            ...(args.select.id ? { id: item.id } : {}),
            ...(args.select.trialEndsAt ? { trialEndsAt: item.trialEndsAt } : {}),
          }));
        }
        return list;
      }),
      update: jest.fn(async (args: any) => {
        const id = args?.where?.id;
        const found = state.subscriptions.find((item) => item.id === id);
        if (!found) throw new Error('subscription not found');
        Object.assign(found, args.data, { updatedAt: nowDate() });
        return found;
      }),
      updateMany: jest.fn(async (args: any) => {
        const ids: string[] = args?.where?.id?.in || [];
        const statuses: string[] = args?.where?.status?.in || [];
        const exactStatus =
          typeof args?.where?.status === 'string' ? args.where.status : undefined;
        const trialEndsAtLt: Date | undefined = args?.where?.trialEndsAt?.lt;
        let count = 0;
        for (const item of state.subscriptions) {
          if (ids.length && !ids.includes(item.id)) continue;
          if (statuses.length && !statuses.includes(item.status)) continue;
          if (exactStatus && item.status !== exactStatus) continue;
          if (trialEndsAtLt && (!item.trialEndsAt || !(item.trialEndsAt < trialEndsAtLt))) continue;
          Object.assign(item, args.data, { updatedAt: nowDate() });
          count += 1;
        }
        return { count };
      }),
    },
    payment: {
      findFirst: jest.fn(paymentFindFirstImpl),
      findMany: jest.fn(async (args: any) => {
        const where = args?.where || {};
        let list = [...state.payments];
        if (where.companyId) list = list.filter((item) => item.companyId === where.companyId);
        if (where.status) list = list.filter((item) => item.status === where.status);
        if (where.dueDate?.lt) list = list.filter((item) => item.dueDate && item.dueDate < where.dueDate.lt);
        if (where.subscription?.status?.in) {
          const allowed = where.subscription.status.in as string[];
          list = list.filter((item) => {
            const subscription = state.subscriptions.find((sub) => sub.id === item.subscriptionId);
            return subscription ? allowed.includes(subscription.status) : false;
          });
        }
        if (args?.distinct?.includes('subscriptionId')) {
          const grouped = new Map<string, Payment>();
          for (const item of list) {
            if (!grouped.has(item.subscriptionId)) grouped.set(item.subscriptionId, item);
          }
          list = Array.from(grouped.values());
        }
        if (args?.select?.subscriptionId) {
          return list.map((item) => ({ subscriptionId: item.subscriptionId }));
        }
        return list;
      }),
      create: jest.fn(async (args: any) => {
        const data = args.data;
        const now = nowDate();
        const created: Payment = {
          id: data.id || `pay_${paymentSeq++}`,
          companyId: data.companyId,
          subscriptionId: data.subscriptionId,
          gateway: data.gateway,
          status: data.status,
          amountCents: data.amountCents,
          currency: data.currency,
          dueDate: data.dueDate || null,
          paidAt: data.paidAt || null,
          gatewayReference: data.gatewayReference || null,
          checkoutUrl: data.checkoutUrl || null,
          externalPaymentId: data.externalPaymentId || null,
          metadata: data.metadata || null,
          createdAt: now,
          updatedAt: now,
        };
        state.payments.push(created);
        return created;
      }),
      update: jest.fn(async (args: any) => {
        const id = args?.where?.id;
        const found = state.payments.find((item) => item.id === id);
        if (!found) throw new Error('payment not found');
        Object.assign(found, args.data, { updatedAt: nowDate() });
        if (args?.include?.subscription?.include?.plan) {
          const subscription = state.subscriptions.find((item) => item.id === found.subscriptionId);
          if (!subscription) throw new Error('subscription not found');
          return {
            ...found,
            subscription: withPlan(subscription),
          };
        }
        return found;
      }),
      updateMany: jest.fn(async (args: any) => {
        let count = 0;
        const where = args?.where || {};
        for (const item of state.payments) {
          if (where.status && item.status !== where.status) continue;
          if (where.dueDate?.lt && (!item.dueDate || !(item.dueDate < where.dueDate.lt))) continue;
          Object.assign(item, args.data, { updatedAt: nowDate() });
          count += 1;
        }
        return { count };
      }),
    },
    webhookEvent: {
      create: jest.fn(async (args: any) => {
        const data = args.data;
        if (
          data.externalEventId &&
          state.webhookEvents.some((item) => item.externalEventId === data.externalEventId)
        ) {
          throw { code: 'P2002' };
        }
        const created: WebhookEvent = {
          id: `wh_${webhookSeq++}`,
          gateway: data.gateway,
          eventType: data.eventType,
          externalEventId: data.externalEventId || null,
          payload: data.payload,
          processStatus: data.processStatus,
          processedAt: data.processedAt || null,
          errorMessage: data.errorMessage || null,
          createdAt: nowDate(),
          companyId: data.companyId || null,
          subscriptionId: data.subscriptionId || null,
        };
        state.webhookEvents.push(created);
        return args?.select?.id ? { id: created.id } : created;
      }),
      update: jest.fn(async (args: any) => {
        const id = args?.where?.id;
        const found = state.webhookEvents.find((item) => item.id === id);
        if (!found) throw new Error('webhook event not found');
        Object.assign(found, args.data);
        return found;
      }),
    },
    $transaction: jest.fn(async (cb: any) => cb(prisma)),
  };

  return { prisma, state };
}
