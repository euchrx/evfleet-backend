import { Injectable } from '@nestjs/common';
import { BillingService } from '../billing.service';
import { CreateSubscriptionCheckoutDto } from '../dto/create-subscription-checkout.dto';

@Injectable()
export class CreateCheckoutForSubscriptionUseCase {
  constructor(private readonly billingService: BillingService) {}

  async execute(
    subscriptionId: string,
    input: CreateSubscriptionCheckoutDto,
    companyId?: string,
  ) {
    return this.billingService.createCheckoutForSubscription(subscriptionId, input, companyId);
  }
}
