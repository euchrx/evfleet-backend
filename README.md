# EvFleet Backend

Backend do EvFleet, plataforma de gestão operacional e financeira focada em rede de postos, abastecimentos, produtos de conveniência e controle da frota vinculada à operação.

## Escopo do sistema

O backend atende os fluxos principais da operação:

- gestão de empresas, usuários e assinatura
- veículos, motoristas e filiais
- abastecimentos e importação de XML de NF-e
- produtos comprados na rede de postos, com categorização automática
- manutenções, pneus, débitos, documentos e viagens
- suporte, notificações e auditoria

## Stack principal

- NestJS
- Prisma
- PostgreSQL
- JWT para autenticação

## Instalação

```bash
npm install
```

## Ambiente local

```bash
# desenvolvimento
npm run start:dev

# produção
npm run start:prod
```

## Banco de dados

```bash
# gerar client Prisma
npx prisma generate

# aplicar migrations
npx prisma migrate deploy

# ambiente local com migration de desenvolvimento
npx prisma migrate dev
```

## Seed

```bash
node prisma/seed.js
```

Regra atual do seed:

- se já existir qualquer usuário com perfil `ADMIN`, o seed não cria outro
- se não existir empresa ativa, o seed cria uma empresa padrão para vincular o admin inicial

## Testes

```bash
# unitários
npm run test

# cobertura
npm run test:cov

# e2e
npm run test:e2e
```

## Organização funcional

Alguns módulos centrais do projeto:

- `auth`
- `companies`
- `billing`
- `fuel-records`
- `xml-import`
- `retail-products`
- `maintenance-records`
- `support`

## Observações

- o sistema foi evoluído para tratar XML de NF-e com foco em abastecimentos e produtos da rede de postos
- o fluxo de assinatura e cobrança deve refletir pagamento confirmado antes de alterar o plano ativo
- funcionalidades administrativas convivem com fluxos operacionais da ponta
