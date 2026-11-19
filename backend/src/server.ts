import 'dotenv/config';
import http from 'http';
import { createApp } from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { disconnectPrisma } from './db/prisma';
import { disconnectRedis } from './db/redis';

async function main() {
  const app = createApp();
  const server = http.createServer(app);

  server.listen(config.PORT, () => {
    logger.info({ port: config.PORT, env: config.NODE_ENV }, 'API server started');
  });

  async function shutdown(signal: string) {
    logger.info({ signal }, 'Shutting down...');
    server.close(async () => {
      await disconnectPrisma();
      await disconnectRedis();
      logger.info('Server shut down gracefully');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
