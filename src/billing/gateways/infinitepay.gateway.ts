import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type CreateInfinitePayCheckoutInput = {
  amountCents: number;
  currency: string;
  description: string;
  orderNsu: string;
  redirectUrl?: string;
  webhookUrl?: string;
  customer?: Record<string, unknown>;
};

export type CreateInfinitePayCheckoutOutput = {
  gatewayReference: string;
  checkoutUrl: string;
  invoiceSlug?: string;
  transactionNsu?: string;
  receiptUrl?: string;
  rawResponse: unknown;
};

@Injectable()
export class InfinitePayGateway {
  constructor(private readonly configService: ConfigService) {}

  async createCheckoutLink(
    input: CreateInfinitePayCheckoutInput,
  ): Promise<CreateInfinitePayCheckoutOutput> {
    const isMockMode = this.readBooleanEnv('INFINITEPAY_MOCK_MODE');
    const handle = String(this.configService.get<string>('INFINITEPAY_HANDLE') || '').trim();
    const baseUrl =
      String(this.configService.get<string>('INFINITEPAY_BASE_URL') || '').trim() ||
      'https://api.infinitepay.io';
    const apiKey = String(this.configService.get<string>('INFINITEPAY_API_KEY') || '').trim();

    if (!handle) {
      throw new ServiceUnavailableException(
        'Configuracao do InfinitePay ausente. Defina INFINITEPAY_HANDLE.',
      );
    }

    const payload = {
      handle,
      items: [
        {
          description: input.description,
          quantity: 1,
          price: input.amountCents,
        },
      ],
      order_nsu: input.orderNsu,
      ...(input.redirectUrl ? { redirect_url: input.redirectUrl } : {}),
      ...(input.webhookUrl ? { webhook_url: input.webhookUrl } : {}),
      ...(input.customer ? { customer: input.customer } : {}),
    };

    if (isMockMode) {
      return {
        gatewayReference: input.orderNsu,
        checkoutUrl: `${baseUrl.replace(/\/+$/, '')}/mock-checkout/${input.orderNsu}`,
        invoiceSlug: `mock-invoice-${input.orderNsu}`,
        rawResponse: {
          mock: true,
          order_nsu: input.orderNsu,
          checkout_url: `${baseUrl.replace(/\/+$/, '')}/mock-checkout/${input.orderNsu}`,
        },
      };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    // Public checkout does not require API key, but keep optional header for private setups.
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const endpoint = `${baseUrl.replace(/\/+$/, '')}/invoices/public/checkout/links`;
    const response = await fetch(
      endpoint,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      },
    );

    let body: any = null;
    let rawBody = '';
    try {
      rawBody = await response.text();
      body = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      body = null;
    }

    if (!response.ok) {
      const upstreamBody = rawBody || JSON.stringify(body ?? null);
      // Diagnóstico de integração: payload e resposta real do provedor.
      console.error('[InfinitePayGateway] createCheckoutLink upstream error', {
        endpoint,
        payload,
        status: response.status,
        body: upstreamBody,
      });
      throw new BadGatewayException({
        message: 'InfinitePay retornou erro ao criar checkout.',
        upstreamStatus: response.status,
        upstreamBody,
      });
    }

    const gatewayReference = String(
      body?.order_nsu || body?.data?.order_nsu || input.orderNsu || '',
    ).trim();
    const checkoutUrl = String(
      body?.checkout_url ||
        body?.checkoutUrl ||
        body?.url ||
        body?.invoice_url ||
        body?.payment_url ||
        body?.data?.checkout_url ||
        body?.data?.checkoutUrl ||
        body?.data?.invoice_url ||
        '',
    ).trim();
    const invoiceSlug = String(body?.invoice_slug || body?.data?.invoice_slug || '').trim();
    const transactionNsu = String(
      body?.transaction_nsu || body?.data?.transaction_nsu || '',
    ).trim();
    const receiptUrl = String(body?.receipt_url || body?.data?.receipt_url || '').trim();

    if (!gatewayReference || !checkoutUrl) {
      throw new BadGatewayException(
        'Resposta da InfinitePay sem gatewayReference/checkoutUrl. Revise o mapeamento do adapter.',
      );
    }

    return {
      gatewayReference,
      checkoutUrl,
      ...(invoiceSlug ? { invoiceSlug } : {}),
      ...(transactionNsu ? { transactionNsu } : {}),
      ...(receiptUrl ? { receiptUrl } : {}),
      rawResponse: body,
    };
  }

  async checkPayment(orderNsu: string) {
    const isEnabled = this.readBooleanEnv('INFINITEPAY_ENABLE_PAYMENT_CHECK');
    if (!isEnabled) return null;

    const baseUrl =
      String(this.configService.get<string>('INFINITEPAY_BASE_URL') || '').trim() ||
      'https://api.infinitepay.io';
    const pathTemplate =
      String(this.configService.get<string>('INFINITEPAY_PAYMENT_CHECK_PATH') || '').trim() ||
      '/invoices/public/payment_check/{order_nsu}';
    const apiKey = String(this.configService.get<string>('INFINITEPAY_API_KEY') || '').trim();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const path = pathTemplate.replace('{order_nsu}', encodeURIComponent(orderNsu));
    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}${path}`, {
      method: 'GET',
      headers,
    });
    if (!response.ok) return null;

    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  private readBooleanEnv(key: string) {
    const value = String(this.configService.get<string>(key) || '').trim().toLowerCase();
    return value === '1' || value === 'true' || value === 'yes' || value === 'on';
  }
}
