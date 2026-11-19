import 'dotenv/config';
import { logger } from './utils/logger';
import { disconnectPrisma } from './db/prisma';
import { disconnectRedis } from './db/redis';

async function main() {
  logger.info('Worker process starting...');
  logger.info('Worker ready (queue integration coming in Phase 6)');

  async function shutdown(signal: string) {
    logger.info({ signal }, 'Worker shutting down...');
    await disconnectPrisma();
    await disconnectRedis();
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});
