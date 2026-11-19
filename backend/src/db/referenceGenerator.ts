import { getPrismaClient } from './prisma';

export async function generateReference(): Promise<string> {
  const prisma = getPrismaClient();
  await prisma.$executeRaw`UPDATE request_counter SET value = value + 1 WHERE id = 1`;
  const result = await prisma.$queryRaw<{ value: number }[]>`SELECT value FROM request_counter WHERE id = 1`;
  const counter = result[0].value;
  return `SR-${String(counter).padStart(6, '0')}`;
}
