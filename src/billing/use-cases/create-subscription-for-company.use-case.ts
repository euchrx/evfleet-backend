import { Injectable } from '@nestjs/common';
import { BillingService } from '../billing.service';

@Injectable()
export class CreateSubscriptionForCompanyUseCase {
  constructor(private readonly billingService: BillingService) {}

  async execute(companyId: string, planId: string) {
    return this.billingService.createSubscriptionForCompany(companyId, planId);
  }
}

