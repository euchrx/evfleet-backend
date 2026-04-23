import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BillingController } from './billing.controller';
import { BillingWebhookSignatureService } from './billing-webhook-signature.service';
import { BillingService } from './billing.service';
import { BillingLifecycleService } from './billing-lifecycle.service';
import { BillingAccessService } from './billing-access.service';
import { InfinitePayGateway } from './gateways/infinitepay.gateway';
import { CreateCheckoutForSubscriptionUseCase } from './use-cases/create-checkout-for-subscription.use-case';
import { CreateInitialPaymentForSubscriptionUseCase } from './use-cases/create-initial-payment-for-subscription.use-case';
import { CreateSubscriptionForCompanyUseCase } from './use-cases/create-subscription-for-company.use-case';

@Module({
  imports: [ConfigModule],
  controllers: [BillingController],
  providers: [
    BillingService,
    BillingWebhookSignatureService,
    BillingLifecycleService,
    BillingAccessService,
    InfinitePayGateway,
    CreateCheckoutForSubscriptionUseCase,
    CreateInitialPaymentForSubscriptionUseCase,
    CreateSubscriptionForCompanyUseCase,
  ],
  exports: [
    BillingService,
    BillingLifecycleService,
    BillingWebhookSignatureService,
    BillingAccessService,
  ],
})
export class BillingModule {}
