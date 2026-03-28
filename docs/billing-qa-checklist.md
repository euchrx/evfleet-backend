# Billing QA Checklist (Multiempresa)

## 1. Pré-requisitos

- [ ] Backend rodando
- [ ] Variáveis configuradas: `INFINITEPAY_HANDLE`, `INFINITEPAY_WEBHOOK_SECRET`
- [ ] `INFINITEPAY_BASE_URL` configurada (ou usar padrão)
- [ ] Pelo menos 1 `Plan` ativo
- [ ] Usuário autenticado com `companyId`

## 2. Fluxo principal (happy path)

- [ ] Criar `Subscription` para a `Company`
- [ ] Gerar `Payment` (`POST /billing/subscriptions/:subscriptionId/pay`)
- [ ] Validar retorno com `checkoutUrl`
- [ ] Validar que `Payment.gatewayReference` foi preenchido com `order_nsu`
- [ ] Simular webhook com assinatura válida
- [ ] Verificar `Payment = PAID`
- [ ] Verificar `Subscription = ACTIVE`
- [ ] Validar acesso em rota protegida

## 3. Webhook e conciliação

- [ ] Enviar webhook com `order_nsu` e confirmar que localiza o `Payment`
- [ ] Quando houver `transaction_nsu`, validar gravação em `Payment.externalPaymentId`
- [ ] Quando houver `invoice_slug`, validar gravação em `Payment.metadata.invoice_slug`
- [ ] Quando houver `receipt_url`, validar gravação em `Payment.invoiceUrl`
- [ ] Reenviar mesmo evento e validar idempotência (duplicado não reprocessa)

## 4. Segurança do webhook

- [ ] Webhook sem assinatura -> deve falhar (`401`)
- [ ] Webhook com assinatura inválida -> deve falhar (`401`)
- [ ] Webhook com assinatura válida -> deve processar
- [ ] Alterar body após gerar assinatura -> deve falhar

## 5. payment_check (opcional)

- [ ] Com `INFINITEPAY_ENABLE_PAYMENT_CHECK=false`, fluxo segue sem consulta extra
- [ ] Com `INFINITEPAY_ENABLE_PAYMENT_CHECK=true`, validar consulta complementar quando aplicável

## 6. Inadimplência

- [ ] Criar pagamento vencido
- [ ] Rodar rotina de expiração
- [ ] Verificar `Payment = EXPIRED`
- [ ] Verificar `Subscription = PAST_DUE`
- [ ] Verificar bloqueio de rota protegida

## 7. Isolamento multiempresa

- [ ] Usuário não acessa dados de outra `Company`
- [ ] `Subscription` pertence à `Company` correta
- [ ] `Payment` pertence à `Company` correta
