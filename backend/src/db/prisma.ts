import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

let prisma: PrismaClient;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });
    prisma.$on('error', (e: unknown) => logger.error({ e }, 'Prisma error'));
    prisma.$on('warn', (e: unknown) => logger.warn({ e }, 'Prisma warning'));
  }
  return prisma;
}

export async function disconnectPrisma() {
  if (prisma) {
    await prisma.$disconnect();
    logger.info('Prisma disconnected');
  }
}
