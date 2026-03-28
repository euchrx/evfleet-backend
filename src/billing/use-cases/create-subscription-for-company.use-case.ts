import { Injectable } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { BillingService } from '../billing.service';

type CompanySubscriptionInitialStatus = Extract<
  SubscriptionStatus,
  'TRIALING' | 'ACTIVE'
>;

@Injectable()
export class CreateSubscriptionForCompanyUseCase {
  constructor(private readonly billingService: BillingService) {}

  async execute(
    companyId: string,
    planId: string,
    initialStatus?: CompanySubscriptionInitialStatus,
  ) {
    return this.billingService.createSubscriptionForCompany(companyId, planId, initialStatus);
  }
}
