import { Injectable } from '@nestjs/common';
import { BillingService } from '../billing.service';

@Injectable()
export class CreateInitialPaymentForSubscriptionUseCase {
  constructor(private readonly billingService: BillingService) {}

  async execute(subscriptionId: string, companyId?: string) {
    return this.billingService.createInitialPaymentForSubscription(subscriptionId, companyId);
  }
}

