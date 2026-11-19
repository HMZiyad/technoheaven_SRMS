import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../db/redis';
import { RateLimitError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  keyPrefix?: string;
}

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  keyPrefix?: string;
}) {
  const { windowMs, max, keyPrefix = 'global' } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const redis = getRedisClient();
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const key = `ratelimit:${keyPrefix}:${ip}`;

      const count = await redis.incr(key);
      if (count === 1) {
        await redis.pexpire(key, windowMs);
      }

      const remaining = Math.max(0, max - count);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', remaining);

      if (count > max) {
        const ttlMs = await redis.pttl(key);
        const retryAfter = ttlMs > 0 ? Math.ceil(ttlMs / 1000) : Math.ceil(windowMs / 1000);
        res.setHeader('Retry-After', retryAfter);
        throw new RateLimitError();
      }

      next();
    } catch (err) {
      if (err instanceof RateLimitError) {
        return next(err);
      }
      logger.warn({ err }, 'Rate limiter failed, allowing request through');
      next();
    }
  };
}
