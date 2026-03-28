import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class BillingWebhookSignatureService {
  // O nome exato do header pode variar conforme o provedor.
  // Default adotado: x-infinitepay-signature
  private static readonly DEFAULT_SIGNATURE_HEADER = 'x-infinitepay-signature';

  constructor(private readonly configService: ConfigService) {}

  validateOrThrow(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ) {
    if (this.isValidationDisabled()) {
      console.warn(
        '[BillingWebhookSignatureService] Validacao de assinatura desabilitada por INFINITEPAY_DISABLE_WEBHOOK_SIGNATURE=true',
      );
      return true;
    }

    const secret = this.getWebhookSecret();
    const headerName = this.getSignatureHeaderName();
    const incomingSignature = this.readHeader(headers, headerName);

    if (!incomingSignature) {
      throw new UnauthorizedException('Assinatura do webhook ausente.');
    }

    const expectedSignature = this.computeSignature(rawBody, secret);
    if (!this.safeCompare(incomingSignature, expectedSignature)) {
      throw new UnauthorizedException('Assinatura do webhook inválida.');
    }

    return true;
  }

  computeSignature(rawBody: Buffer, secret: string) {
    return createHmac('sha256', secret).update(rawBody).digest('hex');
  }

  private getWebhookSecret() {
    const secret = String(this.configService.get<string>('INFINITEPAY_WEBHOOK_SECRET') || '').trim();
    if (!secret) {
      throw new InternalServerErrorException(
        'INFINITEPAY_WEBHOOK_SECRET não configurado para validação de webhook.',
      );
    }
    return secret;
  }

  private isValidationDisabled() {
    const value = String(
      this.configService.get<string>('INFINITEPAY_DISABLE_WEBHOOK_SIGNATURE') || '',
    )
      .trim()
      .toLowerCase();
    return value === '1' || value === 'true' || value === 'yes' || value === 'on';
  }

  private getSignatureHeaderName() {
    return (
      String(this.configService.get<string>('INFINITEPAY_WEBHOOK_SIGNATURE_HEADER') || '').trim() ||
      BillingWebhookSignatureService.DEFAULT_SIGNATURE_HEADER
    );
  }

  private readHeader(headers: Record<string, string | string[] | undefined>, key: string) {
    const normalizedKey = key.toLowerCase();
    const entries = Object.entries(headers || {});
    const match = entries.find(([headerKey]) => headerKey.toLowerCase() === normalizedKey);
    if (!match) return '';
    const value = match[1];
    if (Array.isArray(value)) return String(value[0] || '').trim();
    return String(value || '').trim();
  }

  private safeCompare(incoming: string, expected: string) {
    const normalizedIncoming = this.normalizeSignature(incoming);
    const normalizedExpected = this.normalizeSignature(expected);

    const incomingBuffer = Buffer.from(normalizedIncoming, 'utf8');
    const expectedBuffer = Buffer.from(normalizedExpected, 'utf8');

    if (incomingBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return timingSafeEqual(incomingBuffer, expectedBuffer);
  }

  private normalizeSignature(signature: string) {
    const trimmed = signature.trim().toLowerCase();
    if (trimmed.startsWith('sha256=')) {
      return trimmed.slice('sha256='.length);
    }
    return trimmed;
  }
}
