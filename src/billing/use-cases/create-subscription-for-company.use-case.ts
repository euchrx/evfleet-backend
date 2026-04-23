import { Injectable } from '@nestjs/common';
import { CreateCompanySubscriptionDto } from '../dto/create-company-subscription.dto';
import { BillingService } from '../billing.service';

type BillingCreateSubscriptionInitialStatus = Parameters<
  BillingService['createSubscriptionForCompany']
>[2];

@Injectable()
export class CreateSubscriptionForCompanyUseCase {
  constructor(private readonly billingService: BillingService) {}

  async execute(
    companyId: string,
    dtoOrPlanId: CreateCompanySubscriptionDto | string,
    initialStatus?: 'DRAFT' | 'TRIALING' | 'ACTIVE',
  ) {
    if (typeof dtoOrPlanId === 'string') {
      return this.billingService.createSubscriptionForCompany(
        companyId,
        dtoOrPlanId,
        this.normalizeInitialStatus(initialStatus),
      );
    }

    return this.billingService.createSubscriptionForCompany(
      companyId,
      dtoOrPlanId.planId,
      this.normalizeInitialStatus(dtoOrPlanId.initialStatus ?? initialStatus),
    );
  }

  private normalizeInitialStatus(
    status?: 'DRAFT' | 'TRIALING' | 'ACTIVE',
  ): BillingCreateSubscriptionInitialStatus {
    // 👇 AQUI está o pulo do gato
    if (status === 'TRIALING' || status === 'ACTIVE') {
      return status as BillingCreateSubscriptionInitialStatus;
    }

    // DRAFT vira undefined → deixa o service decidir
    return undefined as BillingCreateSubscriptionInitialStatus;
  }
}