import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

let redis: Redis;

export function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
    redis.on('connect', () => logger.info('Redis connected'));
    redis.on('error', (err: Error) => logger.error({ err }, 'Redis error'));
    redis.on('close', () => logger.warn('Redis connection closed'));
  }
  return redis;
}

export async function disconnectRedis() {
  if (redis) {
    await redis.quit();
    logger.info('Redis disconnected');
  }
}
