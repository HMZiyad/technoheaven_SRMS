import { ConnectionOptions } from 'bullmq';
import { config } from '../config';

export function getRedisConnectionOptions(): ConnectionOptions {
  try {
    const url = new URL(config.REDIS_URL);
    return {
      host: url.hostname || 'localhost',
      port: url.port ? parseInt(url.port, 10) : 6379,
      username: url.username || undefined,
      password: config.REDIS_PASSWORD || (url.password ? decodeURIComponent(url.password) : undefined),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  } catch {
    return {
      host: 'localhost',
      port: 6379,
      password: config.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }
}

export const redisConnection: ConnectionOptions = getRedisConnectionOptions();

export default redisConnection;
