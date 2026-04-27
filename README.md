# EvFleet Backend

Backend do EvFleet, plataforma de gestão operacional e financeira focada em **rede de postos**, abastecimentos, produtos comprados no posto e controle da frota vinculada à operação.

## Escopo do sistema

O backend atende os fluxos principais do produto:
- empresas, usuários e permissões
- assinatura, cobrança e checkout
- veículos, motoristas e filiais
- abastecimentos e importação de XML de NF-e
- produtos importados da NF-e com categorização automática
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

Observação:
- se o histórico antigo de migrations estiver inconsistente no ambiente local, `db push` pode ser usado como apoio técnico em desenvolvimento, mas o fluxo preferencial continua sendo migrations controladas.

## Seed

```bash
node prisma/seed.js
```

Regra atual do seed:
- se já existir qualquer usuário com perfil `ADMIN`, o seed não cria outro
- se ainda não existir empresa ativa, o seed cria a base mínima para o admin inicial

## Testes

```bash
# unitários
npm run test

# cobertura
npm run test:cov

# e2e
npm run test:e2e
```

## Módulos centrais

- `auth`
- `companies`
- `billing`
- `fuel-records`
- `xml-import`
- `retail-products`
- `maintenance-records`
- `tires`
- `vehicle-documents`
- `support`

## Regras importantes

- mudança de plano só deve refletir após pagamento confirmado
- `Starter` é o plano elegível para o fluxo de suporte do cliente
- aceite legal é versionado por empresa
- o backend sustenta dois fluxos de XML:
  - abastecimentos
  - produtos
- a operação foi moldada para rede de postos e não apenas para frota genérica
