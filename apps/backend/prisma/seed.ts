import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminHash = await argon2.hash('Admin@123456', { type: argon2.argon2id });
  const admin = await prisma.user.upsert({
    where: { email: 'admin@chessplatform.com' },
    update: {},
    create: {
      email: 'admin@chessplatform.com',
      username: 'admin',
      passwordHash: adminHash,
      isVerified: true,
      role: Role.ADMIN,
      rating: 1500,
    },
  });

  await prisma.wallet.upsert({
    where: { userId: admin.id },
    update: {},
    create: { userId: admin.id },
  });

  // Create test players
  const players = [
    { email: 'alice@test.com', username: 'Alice', rating: 1450 },
    { email: 'bob@test.com', username: 'Bob', rating: 1380 },
    { email: 'charlie@test.com', username: 'Charlie', rating: 1620 },
  ];

  for (const p of players) {
    const hash = await argon2.hash('Player@123456', { type: argon2.argon2id });
    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: {},
      create: {
        email: p.email,
        username: p.username,
        passwordHash: hash,
        isVerified: true,
        rating: p.rating,
      },
    });

    await prisma.wallet.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, balance: 100 },
    });
  }

  console.log('Seeding complete!');
  console.log('Admin: admin@chessplatform.com / Admin@123456');
  console.log('Test users: alice@test.com, bob@test.com, charlie@test.com / Player@123456');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
