import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Password123!', 12);

  const user = await prisma.user.upsert({
    where: { email: 'demo@streamvault.dev' },
    update: {},
    create: {
      email: 'demo@streamvault.dev',
      username: 'democreator',
      displayName: 'Demo Creator',
      passwordHash,
      role: 'CREATOR',
      isVerified: true,
    },
  });

  await prisma.channel.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      handle: 'democreator',
      name: 'Demo Creator',
      description: 'Welcome to StreamVault demo channel!',
    },
  });

  const categories = [
    { name: 'Gaming', slug: 'gaming' },
    { name: 'Music', slug: 'music' },
    { name: 'Education', slug: 'education' },
    { name: 'Tech', slug: 'tech' },
    { name: 'Entertainment', slug: 'entertainment' },
    { name: 'Sports', slug: 'sports' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }

  console.log('Seed complete. Demo login: demo@streamvault.dev / Password123!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
