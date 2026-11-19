import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../db/prisma';
import { getRedisClient } from '../db/redis';
import { logger } from '../utils/logger';

export const healthRouter = Router();

healthRouter.get('/live', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

healthRouter.get('/ready', async (_req: Request, res: Response) => {
  const checks: Record<string, string> = {};
  let healthy = true;

  try {
    const prisma = getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch (err) {
    logger.error({ err }, 'DB health check failed');
    checks.database = 'error';
    healthy = false;
  }

  try {
    const redis = getRedisClient();
    await redis.ping();
    checks.redis = 'ok';
  } catch (err) {
    logger.error({ err }, 'Redis health check failed');
    checks.redis = 'error';
    healthy = false;
  }

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});
