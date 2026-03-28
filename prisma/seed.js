const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function resolveCompanyId() {
  const preferredCompanySlug = (process.env.MASTER_ADMIN_COMPANY_SLUG || '').trim();

  if (preferredCompanySlug) {
    const preferredCompany = await prisma.company.findUnique({
      where: { slug: preferredCompanySlug },
      select: { id: true },
    });
    if (preferredCompany) return preferredCompany.id;
  }

  const firstActiveCompany = await prisma.company.findFirst({
    where: { active: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (firstActiveCompany) return firstActiveCompany.id;

  const createdDefault = await prisma.company.create({
    data: {
      name: 'Empresa Padrao',
      slug: 'empresa-padrao',
      active: true,
    },
    select: { id: true },
  });

  console.log('[seed] No active company found. Default company created.');
  return createdDefault.id;
}

async function main() {
  const email = (process.env.MASTER_ADMIN_EMAIL || 'admin@evfleet.com.br').trim();
  const name = (process.env.MASTER_ADMIN_NAME || 'Master Admin').trim();
  const plainPassword = (process.env.MASTER_ADMIN_PASSWORD || '').trim();

  if (!plainPassword) {
    throw new Error('MASTER_ADMIN_PASSWORD nao definido. Configure a variavel de ambiente com uma senha forte.');
  }

  const password = await bcrypt.hash(plainPassword, 10);
  const companyId = await resolveCompanyId();

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      password,
      role: 'ADMIN',
      companyId,
    },
    create: {
      name,
      email,
      password,
      role: 'ADMIN',
      companyId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      companyId: true,
      createdAt: true,
    },
  });

  console.log('[seed] Master admin ready:', {
    id: user.id,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
  });
}

main()
  .catch((error) => {
    console.error('[seed] failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
