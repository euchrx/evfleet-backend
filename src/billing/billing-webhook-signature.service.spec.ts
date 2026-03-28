import { InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingWebhookSignatureService } from './billing-webhook-signature.service';

describe('BillingWebhookSignatureService', () => {
  const createService = (overrides?: Record<string, string>) => {
    const values = {
      INFINITEPAY_WEBHOOK_SECRET: 'secret_test',
      INFINITEPAY_WEBHOOK_SIGNATURE_HEADER: 'x-infinitepay-signature',
      ...(overrides || {}),
    };
    const config = {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
    return new BillingWebhookSignatureService(config);
  };

  it('aceita assinatura valida', () => {
    const service = createService();
    const raw = Buffer.from(JSON.stringify({ hello: 'world' }));
    const sig = service.computeSignature(raw, 'secret_test');

    expect(
      service.validateOrThrow(
        {
          'x-infinitepay-signature': sig,
        },
        raw,
      ),
    ).toBe(true);
  });

  it('rejeita assinatura ausente', () => {
    const service = createService();
    const raw = Buffer.from(JSON.stringify({ hello: 'world' }));

    expect(() => service.validateOrThrow({}, raw)).toThrow(UnauthorizedException);
  });

  it('rejeita assinatura invalida', () => {
    const service = createService();
    const raw = Buffer.from(JSON.stringify({ hello: 'world' }));

    expect(
      () =>
        service.validateOrThrow(
          {
            'x-infinitepay-signature': 'invalid_signature',
          },
          raw,
        ),
    ).toThrow(UnauthorizedException);
  });

  it('rejeita body adulterado', () => {
    const service = createService();
    const rawOriginal = Buffer.from(JSON.stringify({ amount: 100 }));
    const rawTampered = Buffer.from(JSON.stringify({ amount: 999 }));
    const sigOriginal = service.computeSignature(rawOriginal, 'secret_test');

    expect(
      () =>
        service.validateOrThrow(
          {
            'x-infinitepay-signature': sigOriginal,
          },
          rawTampered,
        ),
    ).toThrow(UnauthorizedException);
  });

  it('falha com erro interno se secret nao estiver configurado', () => {
    const service = createService({ INFINITEPAY_WEBHOOK_SECRET: '' });
    const raw = Buffer.from(JSON.stringify({ test: true }));

    expect(
      () =>
        service.validateOrThrow(
          {
            'x-infinitepay-signature': 'any',
          },
          raw,
        ),
    ).toThrow(InternalServerErrorException);
  });
});

