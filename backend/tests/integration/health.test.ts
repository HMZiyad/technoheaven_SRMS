import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';

vi.mock('../../src/db/prisma', () => ({
  getPrismaClient: vi.fn(() => ({
    $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
  })),
  disconnectPrisma: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/db/redis', () => ({
  getRedisClient: vi.fn(() => ({
    ping: vi.fn().mockResolvedValue('PONG'),
    incr: vi.fn().mockResolvedValue(1),
    pexpire: vi.fn().mockResolvedValue(1),
    pttl: vi.fn().mockResolvedValue(60000),
  })),
  disconnectRedis: vi.fn().mockResolvedValue(undefined),
}));

describe('Integration: Health Endpoints', () => {
  const app = createApp();

  describe('GET /api/v1/health/live', () => {
    it('returns 200 and { status: "ok" }', async () => {
      const res = await request(app).get('/api/v1/health/live');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body).toHaveProperty('timestamp');
      expect(typeof res.body.timestamp).toBe('string');
      expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
    });
  });

  describe('GET /api/v1/health/ready', () => {
    it('returns 200 with status ok and service checks', async () => {
      const res = await request(app).get('/api/v1/health/ready');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.checks).toEqual({
        database: 'ok',
        redis: 'ok',
      });
      expect(res.body).toHaveProperty('timestamp');
    });
  });
});
