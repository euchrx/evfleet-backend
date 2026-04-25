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
      name: 'EvSystem',
      slug: 'ev-system',
      active: true,
    },
    select: { id: true },
  });

  console.log('[seed] No active company found. Default company created.');
  return createdDefault.id;
}

async function seedDangerousProducts(companyId) {
  const defaults = [
    {
      name: 'Diesel S10',
      commercialName: 'Óleo Diesel S10',
      unNumber: '1202',
      riskClass: '3',
      packingGroup: 'III',
      hazardNumber: '30',
      emergencyNumber: '0800',
      physicalState: 'Líquido',
      active: true,
    },
    {
      name: 'Gasolina',
      commercialName: 'Gasolina comum',
      unNumber: '1203',
      riskClass: '3',
      packingGroup: 'II',
      hazardNumber: '33',
      emergencyNumber: '0800',
      physicalState: 'Líquido',
      active: true,
    },
    {
      name: 'Etanol',
      commercialName: 'Etanol hidratado',
      unNumber: '1170',
      riskClass: '3',
      packingGroup: 'II',
      hazardNumber: '33',
      emergencyNumber: '0800',
      physicalState: 'Líquido',
      active: true,
    },
  ];

  for (const product of defaults) {
    const exists = await prisma.dangerousProduct.findFirst({
      where: {
        companyId,
        OR: [
          { name: product.name },
          { unNumber: product.unNumber },
        ],
      },
      select: { id: true },
    });

    if (exists) {
      console.log(`[seed] Dangerous product already exists: ${product.name}`);
      continue;
    }

    await prisma.dangerousProduct.create({
      data: {
        companyId,
        ...product,
      },
    });

    console.log(`[seed] Dangerous product created: ${product.name}`);
  }
}

async function main() {
  const email = (process.env.MASTER_ADMIN_EMAIL || 'christian@evsystem.com.br').trim();
  const name = (process.env.MASTER_ADMIN_NAME || 'Christian').trim();
  const plainPassword = (process.env.MASTER_ADMIN_PASSWORD || '').trim();

  if (!plainPassword) {
    throw new Error('MASTER_ADMIN_PASSWORD nao definido. Configure a variavel de ambiente com uma senha forte.');
  }

  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      companyId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (existingAdmin) {
    console.log('[seed] Admin already exists. Skipping master admin creation:', {
      id: existingAdmin.id,
      email: existingAdmin.email,
      role: existingAdmin.role,
      companyId: existingAdmin.companyId,
    });

    await seedDangerousProducts(existingAdmin.companyId);

    return;
  }

  const password = await bcrypt.hash(plainPassword, 10);
  const companyId = await resolveCompanyId();
  await seedDangerousProducts(companyId);

  const user = await prisma.user.create({
    data: {
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
