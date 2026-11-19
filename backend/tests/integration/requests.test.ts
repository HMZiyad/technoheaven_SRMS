import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { signAccessToken } from '../../src/utils/token';
import { Role } from '../../src/types';

vi.mock('../../src/services/request.service', () => ({
  requestService: {
    createRequest: vi.fn().mockResolvedValue({ id: 'req-1' }),
    listRequests: vi.fn().mockResolvedValue({ requests: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }),
  },
}));

vi.mock('../../src/services/auth.service', () => ({
  authService: {
    isTokenRevoked: vi.fn().mockResolvedValue(false),
  },
}));

vi.mock('../../src/repositories/user.repository', () => ({
  userRepository: {
    findById: vi.fn().mockResolvedValue({
      id: 'mock-user-id',
      name: 'Test Operator',
      email: 'operator@srms.local',
      role: 'OPERATOR',
      active: true,
    }),
  },
}));

vi.mock('../../src/db/redis', () => ({
  getRedisClient: vi.fn(() => ({
    incr: vi.fn().mockResolvedValue(1),
    pexpire: vi.fn().mockResolvedValue(1),
    pttl: vi.fn().mockResolvedValue(60000),
    ping: vi.fn().mockResolvedValue('PONG'),
    exists: vi.fn().mockResolvedValue(0),
  })),
  disconnectRedis: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/db/prisma', () => ({
  getPrismaClient: vi.fn(() => ({
    $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
  })),
  disconnectPrisma: vi.fn().mockResolvedValue(undefined),
}));

describe('Integration: Requests Endpoints Validation', () => {
  const app = createApp();
  let authToken: string;

  beforeAll(async () => {
    const res = await signAccessToken({
      sub: 'mock-user-id',
      role: Role.OPERATOR,
      email: 'operator@srms.local',
      name: 'Test Operator',
    });
    authToken = res.token;
  });

  describe('POST /api/v1/requests - Validation Errors', () => {
    it('returns 400 VALIDATION_ERROR when body is empty', async () => {
      const res = await request(app)
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const fields = res.body.error.details.map((d: any) => d.field);
      expect(fields).toContain('title');
      expect(fields).toContain('description');
      expect(fields).toContain('category');
      expect(fields).toContain('customerName');
      expect(fields).toContain('customerContact');
    });

    it('returns 400 VALIDATION_ERROR when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Description without title',
          category: 'TECHNICAL',
          customerName: 'Alice',
          customerContact: 'alice@example.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const fields = res.body.error.details.map((d: any) => d.field);
      expect(fields).toContain('title');
    });

    it('returns 400 VALIDATION_ERROR when category is invalid', async () => {
      const res = await request(app)
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Valid Request Title',
          description: 'Valid request description with enough length',
          category: 'INVALID_CATEGORY_NAME',
          priority: 'MEDIUM',
          customerName: 'Alice',
          customerContact: 'alice@example.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const fields = res.body.error.details.map((d: any) => d.field);
      expect(fields).toContain('category');
    });

    it('returns 400 VALIDATION_ERROR when priority is invalid', async () => {
      const res = await request(app)
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Valid Request Title',
          description: 'Valid request description with enough length',
          category: 'TECHNICAL',
          priority: 'SUPER_URGENT',
          customerName: 'Alice',
          customerContact: 'alice@example.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const fields = res.body.error.details.map((d: any) => d.field);
      expect(fields).toContain('priority');
    });

    it('returns 400 VALIDATION_ERROR when title is shorter than 3 characters', async () => {
      const res = await request(app)
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'ab',
          description: 'Valid description here',
          category: 'GENERAL',
          customerName: 'Alice',
          customerContact: 'alice@example.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const fields = res.body.error.details.map((d: any) => d.field);
      expect(fields).toContain('title');
    });

    it('returns 400 VALIDATION_ERROR when description is shorter than 5 characters', async () => {
      const res = await request(app)
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Valid Title',
          description: 'tiny',
          category: 'GENERAL',
          customerName: 'Alice',
          customerContact: 'alice@example.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const fields = res.body.error.details.map((d: any) => d.field);
      expect(fields).toContain('description');
    });

    it('returns 400 VALIDATION_ERROR when unrecognized extra properties are passed', async () => {
      const res = await request(app)
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Valid Request Title',
          description: 'Valid request description with enough length',
          category: 'TECHNICAL',
          customerName: 'Alice',
          customerContact: 'alice@example.com',
          status: 'COMPLETED',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/requests - Query Params Validation', () => {
    it('returns 400 VALIDATION_ERROR when page is less than 1', async () => {
      const res = await request(app)
        .get('/api/v1/requests?page=0')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const fields = res.body.error.details.map((d: any) => d.field);
      expect(fields).toContain('page');
    });

    it('returns 400 VALIDATION_ERROR when limit is less than 1 or exceeds 100', async () => {
      const resUnder = await request(app)
        .get('/api/v1/requests?limit=0')
        .set('Authorization', `Bearer ${authToken}`);

      expect(resUnder.status).toBe(400);
      expect(resUnder.body.error.code).toBe('VALIDATION_ERROR');

      const resOver = await request(app)
        .get('/api/v1/requests?limit=101')
        .set('Authorization', `Bearer ${authToken}`);

      expect(resOver.status).toBe(400);
      expect(resOver.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 VALIDATION_ERROR when status query parameter is invalid', async () => {
      const res = await request(app)
        .get('/api/v1/requests?status=INVALID_STATUS')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const fields = res.body.error.details.map((d: any) => d.field);
      expect(fields).toContain('status');
    });

    it('returns 400 VALIDATION_ERROR when priority query parameter is invalid', async () => {
      const res = await request(app)
        .get('/api/v1/requests?priority=EXTREME')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const fields = res.body.error.details.map((d: any) => d.field);
      expect(fields).toContain('priority');
    });

    it('returns 400 VALIDATION_ERROR when category query parameter is invalid', async () => {
      const res = await request(app)
        .get('/api/v1/requests?category=NON_EXISTENT')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const fields = res.body.error.details.map((d: any) => d.field);
      expect(fields).toContain('category');
    });

    it('returns 400 VALIDATION_ERROR when sort field is not an allowed column', async () => {
      const res = await request(app)
        .get('/api/v1/requests?sort=password')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const fields = res.body.error.details.map((d: any) => d.field);
      expect(fields).toContain('sort');
    });

    it('returns 400 VALIDATION_ERROR when order is neither asc nor desc', async () => {
      const res = await request(app)
        .get('/api/v1/requests?order=random')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const fields = res.body.error.details.map((d: any) => d.field);
      expect(fields).toContain('order');
    });

    it('returns 400 VALIDATION_ERROR when assignedToId or createdById is not a valid UUID', async () => {
      const res1 = await request(app)
        .get('/api/v1/requests?assignedToId=not-a-uuid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res1.status).toBe(400);
      expect(res1.body.error.code).toBe('VALIDATION_ERROR');

      const res2 = await request(app)
        .get('/api/v1/requests?createdById=12345')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 VALIDATION_ERROR when datetime from/to format is invalid', async () => {
      const res = await request(app)
        .get('/api/v1/requests?from=2026-13-45')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const fields = res.body.error.details.map((d: any) => d.field);
      expect(fields).toContain('from');
    });
  });
});
