import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { AllowInadimplenteAccess } from '../auth/allow-inadimplente-access.decorator';
import { BillingWebhookSignatureService } from './billing-webhook-signature.service';
import { BillingService } from './billing.service';
import { CheckPaymentDto } from './dto/check-payment.dto';
import { CreateCompanySubscriptionDto } from './dto/create-company-subscription.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreateSubscriptionPaymentDto } from './dto/create-subscription-payment.dto';
import { CreateSubscriptionCheckoutDto } from './dto/create-subscription-checkout.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { CreateCheckoutForSubscriptionUseCase } from './use-cases/create-checkout-for-subscription.use-case';
import { CreateInitialPaymentForSubscriptionUseCase } from './use-cases/create-initial-payment-for-subscription.use-case';
import { CreateSubscriptionForCompanyUseCase } from './use-cases/create-subscription-for-company.use-case';

@AllowInadimplenteAccess()
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly billingWebhookSignatureService: BillingWebhookSignatureService,
    private readonly createCheckoutForSubscriptionUseCase: CreateCheckoutForSubscriptionUseCase,
    private readonly createInitialPaymentForSubscriptionUseCase: CreateInitialPaymentForSubscriptionUseCase,
    private readonly createSubscriptionForCompanyUseCase: CreateSubscriptionForCompanyUseCase,
  ) {}

  @Get('plans')
  async getPlans(@Req() req: any) {
    const companyId =
      (req?.companyScopeId as string | undefined) ||
      (req?.user?.companyId as string | undefined);
    return this.billingService.listPlans(companyId);
  }

  @Get('me/subscription')
  async getMySubscription(@Req() req: any) {
    const companyId = this.requireAuthenticatedCompanyId(req);
    return this.billingService.getCompanySubscription(companyId);
  }

  @Get('me/payments')
  async getMyPayments(@Req() req: any) {
    const companyId = this.requireAuthenticatedCompanyId(req);
    return this.billingService.getCompanyPayments(companyId);
  }

  @Post('me/pay')
  async payMyCompany(@Req() req: any, @Body() dto: CreateSubscriptionPaymentDto) {
    const companyId = this.requireAuthenticatedCompanyId(req);
    return this.billingService.createInitialPaymentForCompany(companyId, dto.planId);
  }

  @Post('me/subscription')
  async selectMyCompanyPlan(@Body() dto: CreateCompanySubscriptionDto, @Req() req: any) {
    const companyId = this.requireAuthenticatedCompanyId(req);
    return this.createSubscriptionForCompanyUseCase.execute(
      companyId,
      dto.planId,
      dto.initialStatus,
    );
  }

  @Post('check-payment')
  async checkPayment(@Body() dto: CheckPaymentDto, @Req() req: any) {
    return this.billingService.checkPaymentFallback(dto, {
      companyId: req?.companyScopeId || req?.user?.companyId,
      role: req?.user?.role,
    });
  }

  @Roles('ADMIN')
  @Post('plans')
  async createPlan(@Body() dto: CreatePlanDto) {
    return this.billingService.createPlan(dto);
  }

  @Roles('ADMIN')
  @Patch('plans/:planId')
  async updatePlan(@Param('planId') planId: string, @Body() dto: UpdatePlanDto) {
    return this.billingService.updatePlan(planId, dto);
  }

  @Roles('ADMIN')
  @Delete('plans/:planId')
  async deletePlan(@Param('planId') planId: string) {
    return this.billingService.deletePlan(planId);
  }

  @Roles('ADMIN')
  @Get('subscription')
  async getCompanySubscription(@Query('companyId') companyId?: string, @Req() req?: any) {
    const isAdmin = req?.user?.role === 'ADMIN';
    const resolvedCompanyId = companyId || req?.companyScopeId || (isAdmin ? undefined : req?.user?.companyId);
    if (!resolvedCompanyId) return null;
    this.assertCompanyAccess(resolvedCompanyId, req);
    return this.billingService.getCompanySubscription(resolvedCompanyId);
  }

  @Roles('ADMIN')
  @Get('companies/:companyId/subscription')
  async getCompanySubscriptionByPath(@Param('companyId') companyId: string, @Req() req: any) {
    this.assertCompanyAccess(companyId, req);
    return this.billingService.getCompanySubscription(companyId);
  }

  @Roles('ADMIN')
  @Get('companies/:companyId/payments')
  async getCompanyPayments(@Param('companyId') companyId: string, @Req() req: any) {
    this.assertCompanyAccess(companyId, req);
    return this.billingService.getCompanyPayments(companyId);
  }

  @Roles('ADMIN')
  @Delete('companies/:companyId/payments')
  async clearCompanyPayments(@Param('companyId') companyId: string, @Req() req: any) {
    this.assertCompanyAccess(companyId, req);
    return this.billingService.clearCompanyPayments(companyId);
  }

  @Roles('ADMIN')
  @Post('companies/:companyId/subscription')
  async createSubscriptionForCompany(
    @Param('companyId') companyId: string,
    @Body() dto: CreateCompanySubscriptionDto,
  ) {
    return this.createSubscriptionForCompanyUseCase.execute(
      companyId,
      dto.planId,
      dto.initialStatus,
    );
  }

  @Roles('ADMIN')
  @Post('companies/:companyId/subscription/cancel')
  async cancelCompanySubscription(@Param('companyId') companyId: string) {
    return this.billingService.cancelCompanySubscription(companyId);
  }

  @Roles('ADMIN')
  @Post('companies/:companyId/subscription/activate')
  async activateCompanySubscription(@Param('companyId') companyId: string) {
    return this.billingService.activateCompanySubscription(companyId);
  }

  @Roles('ADMIN')
  @Post('subscriptions/:subscriptionId/pay')
  async createInitialPaymentForSubscription(
    @Param('subscriptionId') subscriptionId: string,
    @Body() dto: CreateSubscriptionPaymentDto,
    @Req() req: any,
  ) {
    return this.createInitialPaymentForSubscriptionUseCase.execute(
      subscriptionId,
      req?.user?.companyId,
      dto.planId,
    );
  }

  @Roles('ADMIN')
  @Post('subscriptions/:subscriptionId/checkout')
  async createCheckoutForSubscription(
    @Param('subscriptionId') subscriptionId: string,
    @Body() dto: CreateSubscriptionCheckoutDto,
    @Req() req: any,
  ) {
    return this.createCheckoutForSubscriptionUseCase.execute(
      subscriptionId,
      dto,
      req?.user?.companyId,
    );
  }

  @Public()
  @Get('webhooks/infinitepay')
  async getInfinitePayWebhookDebug() {
    return { ok: true, route: '/billing/webhooks/infinitepay', method: 'GET' };
  }

  @Public()
  @Post('webhooks/infinitepay')
  async handleInfinitePayWebhook(
    @Body() payload: unknown,
    @Headers() headers: Record<string, string | string[]>,
    @Req() req: any,
  ) {
    this.logWebhook('[InfinitePay webhook] POST recebido');
    this.logWebhook('[InfinitePay webhook] headers', headers);
    this.logWebhook('[InfinitePay webhook] body', payload);

    const rawBody =
      req?.rawBody instanceof Buffer ? req.rawBody : Buffer.from(JSON.stringify(payload ?? {}));
    this.billingWebhookSignatureService.validateOrThrow(headers, rawBody);

    const result = await this.billingService.handleInfinitePayWebhook(payload, headers);
    this.logWebhook('[InfinitePay webhook] resultado', result);
    this.logWebhook('[InfinitePay webhook] resposta HTTP final', 200);
    return result;
  }

  private logWebhook(message: string, payload?: unknown) {
    void message;
    void payload;
  }

  private assertCompanyAccess(companyId: string, req: any) {
    const authenticatedCompanyId = req?.user?.companyId as string | undefined;
    const role = req?.user?.role as string | undefined;
    if (role === 'ADMIN') return;
    if (authenticatedCompanyId && authenticatedCompanyId !== companyId) {
      throw new ForbiddenException('Acesso negado para dados de outra empresa.');
    }
  }

  private requireAuthenticatedCompanyId(req: any): string {
    const companyId = (req?.user?.companyId as string | undefined)?.trim();
    if (!companyId) {
      throw new BadRequestException(
        'Usuário autenticado sem companyId. Vincule o usuário a uma empresa.',
      );
    }
    return companyId;
  }
}
