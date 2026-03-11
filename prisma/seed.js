const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.MASTER_ADMIN_EMAIL || 'admin@evfleet.com.br').trim();
  const name = (process.env.MASTER_ADMIN_NAME || 'Master Admin').trim();
  const plainPassword = (process.env.MASTER_ADMIN_PASSWORD || '').trim();

  if (!plainPassword) {
    throw new Error('MASTER_ADMIN_PASSWORD nao definido. Configure a variavel de ambiente com uma senha forte.');
  }

  const password = await bcrypt.hash(plainPassword, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      password,
      role: 'ADMIN',
    },
    create: {
      name,
      email,
      password,
      role: 'ADMIN',
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  console.log('[seed] Master admin ready:', {
    id: user.id,
    email: user.email,
    role: user.role,
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