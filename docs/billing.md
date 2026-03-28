# Billing Multiempresa (Operacional)

## 1. Visão geral

- **Company**: empresa dona da conta (quem paga).
- **Subscription**: assinatura da empresa (status e período).
- **Payment**: cobrança da assinatura.
- **Webhook**: confirmação assíncrona de pagamento.
- **Guard de assinatura**: bloqueia acesso quando assinatura está `PAST_DUE` ou `CANCELED`.

Fluxo resumido:
1. Criar assinatura da empresa.
2. Gerar cobrança com checkout.
3. Cliente paga no checkout da InfinitePay.
4. Webhook confirma pagamento.
5. Sistema atualiza `Payment` e `Subscription`.

---

## 2. Variáveis de ambiente

### Obrigatórias

- `INFINITEPAY_HANDLE`  
  Handle da conta InfinitePay usado no checkout público.

- `INFINITEPAY_WEBHOOK_SECRET`  
  Segredo para validar HMAC do webhook.

### Recomendadas

- `INFINITEPAY_BASE_URL`  
  Base da API. Padrão no código: `https://api.infinitepay.io`.

### Opcionais

- `INFINITEPAY_API_KEY`  
  **Não é obrigatória** para o checkout público atual.  
  Se informada, é enviada como `Authorization: Bearer`.

- `INFINITEPAY_WEBHOOK_SIGNATURE_HEADER`  
  Header da assinatura do webhook.  
  Padrão no código: `x-infinitepay-signature`.

- `INFINITEPAY_MOCK_MODE`  
  `true` para retornar checkout simulado sem chamada externa.

- `INFINITEPAY_ENABLE_PAYMENT_CHECK`  
  `true` para habilitar consulta complementar de pagamento.

- `INFINITEPAY_PAYMENT_CHECK_PATH`  
  Path da consulta complementar.  
  Padrão: `/invoices/public/payment_check/{order_nsu}`.

---

## 3. Fluxo de cobrança (passo a passo)

1. Criar/ter uma `Company`.
2. Criar `Subscription` para a empresa em um `Plan`.
3. Gerar `Payment` inicial.
4. Backend chama checkout público da InfinitePay:
   - `POST /invoices/public/checkout/links`
5. Cliente paga.
6. Webhook chega no backend.
7. Backend valida assinatura HMAC com `rawBody`.
8. Backend atualiza:
   - `Payment.status = PAID`
   - `Subscription.status = ACTIVE`
   - período atual e próximo vencimento.

---

## 4. Endpoints principais

Base: `/billing`  
Acesso: `ADMIN` nas rotas de gestão; webhook é público.

### POST `/billing/companies/:companyId/subscription`
Cria assinatura da empresa.

### POST `/billing/subscriptions/:subscriptionId/pay`
Cria cobrança inicial e retorna `checkoutUrl`.

### GET `/billing/companies/:companyId/subscription`
Consulta assinatura atual da empresa.

### GET `/billing/companies/:companyId/payments`
Lista cobranças da empresa.

### POST `/billing/webhooks/infinitepay`
Recebe webhook da InfinitePay (com validação de assinatura).

---

## 5. Checkout público InfinitePay (payload real)

Endpoint externo:
- `POST https://api.infinitepay.io/invoices/public/checkout/links`

Payload enviado pelo backend:

```json
{
  "handle": "seu_handle",
  "items": [
    {
      "description": "Primeiro pagamento da assinatura Plano Pro",
      "quantity": 1,
      "price": 19900
    }
  ],
  "order_nsu": "initial_sub_xxx_1711599999999",
  "redirect_url": "https://app.exemplo.com/billing/sucesso",
  "webhook_url": "https://api.exemplo.com/billing/webhooks/infinitepay",
  "customer": {
    "name": "Empresa Exemplo",
    "document": "12345678000199"
  }
}
```

Observações:
- `order_nsu` é a referência principal de conciliação.
- `items[].price` é enviado em centavos.
- `redirect_url`, `webhook_url` e `customer` são opcionais.

---

## 6. Webhook real (campos usados)

Campos priorizados no processamento:
- `order_nsu` -> `Payment.gatewayReference` (chave principal de busca)
- `transaction_nsu` -> `Payment.externalPaymentId`
- `invoice_slug` -> `Payment.metadata.invoice_slug`
- `receipt_url` -> `Payment.invoiceUrl`
- `amount`, `paid_amount`, `capture_method`, `items` -> usados como contexto de evento

Exemplo de webhook:

```json
{
  "id": "evt_123",
  "type": "payment.updated",
  "order_nsu": "initial_sub_xxx_1711599999999",
  "transaction_nsu": "txn_987654",
  "invoice_slug": "inv_abcd1234",
  "amount": 19900,
  "paid_amount": 19900,
  "capture_method": "PAID",
  "receipt_url": "https://receipt.infinitepay.io/abc",
  "items": [
    {
      "description": "Primeiro pagamento da assinatura Plano Pro",
      "quantity": 1,
      "price": 19900
    }
  ]
}
```

---

## 7. payment_check (opcional)

Quando `payment_check` vem habilitado no evento e o status não está confirmado, o backend pode chamar verificação complementar no gateway (se `INFINITEPAY_ENABLE_PAYMENT_CHECK=true`).

Uso:
- reduz falso negativo em eventos com status transitório;
- mantém processamento idempotente.

---

## 8. Segurança do webhook

Implementação atual:
- usa `rawBody` do request;
- gera HMAC SHA256 com `INFINITEPAY_WEBHOOK_SECRET`;
- compara com `crypto.timingSafeEqual`.

Resultado:
- assinatura ausente/inválida -> `401`;
- evento inválido não é processado.

---

## 9. Boas práticas

- Sempre usar `companyId` no contexto multiempresa.
- Não confiar em status enviado pelo frontend.
- Validar assinatura do webhook em todos os ambientes.
- Tratar webhook com idempotência (não reprocessar evento duplicado).
- Usar `order_nsu` como referência principal de conciliação.
