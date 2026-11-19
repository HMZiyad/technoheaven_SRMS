import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { signAccessToken } from '../../src/utils/token';
import { Role } from '../../src/types';

vi.mock('../../src/services/auth.service', () => ({
  authService: {
    register: vi.fn().mockResolvedValue({
      user: { id: 'u1', name: 'User One', email: 'u1@example.com', role: 'OPERATOR' },
      token: 'mock-jwt-token',
    }),
    login: vi.fn().mockResolvedValue({
      user: { id: 'u1', name: 'User One', email: 'u1@example.com', role: 'OPERATOR' },
      token: 'mock-jwt-token',
    }),
    logout: vi.fn().mockResolvedValue(undefined),
    isTokenRevoked: vi.fn().mockResolvedValue(false),
  },
}));

vi.mock('../../src/repositories/user.repository', () => ({
  userRepository: {
    findById: vi.fn().mockResolvedValue({
      id: 'u1',
      name: 'User One',
      email: 'u1@example.com',
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
    setex: vi.fn().mockResolvedValue('OK'),
  })),
  disconnectRedis: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/db/prisma', () => ({
  getPrismaClient: vi.fn(() => ({
    $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
  })),
  disconnectPrisma: vi.fn().mockResolvedValue(undefined),
}));

describe('Integration: Auth Endpoints', () => {
  const app = createApp();

  describe('POST /api/v1/auth/register - Validation Errors', () => {
    it('returns 400 VALIDATION_ERROR when request body is empty', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(res.body.error.details)).toBe(true);
      const fields = res.body.error.details.map((d: any) => d.field);
      expect(fields).toContain('name');
      expect(fields).toContain('email');
      expect(fields).toContain('password');
    });

    it('returns 400 VALIDATION_ERROR when email is invalid', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Valid Name',
        email: 'not-an-email',
        password: 'ValidPassword123!',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const details = res.body.error.details;
      expect(details.some((d: any) => d.field === 'email')).toBe(true);
    });

    it('returns 400 VALIDATION_ERROR when password is shorter than 10 characters', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Valid Name',
        email: 'user@example.com',
        password: 'short',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const details = res.body.error.details;
      expect(details.some((d: any) => d.field === 'password')).toBe(true);
    });

    it('returns 400 VALIDATION_ERROR when name is shorter than 2 characters', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'A',
        email: 'user@example.com',
        password: 'ValidPassword123!',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const details = res.body.error.details;
      expect(details.some((d: any) => d.field === 'name')).toBe(true);
    });

    it('returns 400 VALIDATION_ERROR when unexpected extra fields are provided', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Valid Name',
        email: 'user@example.com',
        password: 'ValidPassword123!',
        role: 'ADMIN',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/login - Validation Errors', () => {
    it('returns 400 VALIDATION_ERROR when request body is empty', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const fields = res.body.error.details.map((d: any) => d.field);
      expect(fields).toContain('email');
      expect(fields).toContain('password');
    });

    it('returns 400 VALIDATION_ERROR when email format is invalid', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'not-valid-email',
        password: 'anypassword',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const details = res.body.error.details;
      expect(details.some((d: any) => d.field === 'email')).toBe(true);
    });

    it('returns 400 VALIDATION_ERROR when password is missing or empty', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'user@example.com',
        password: '',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Auth Endpoints Structure', () => {
    it('POST /api/v1/auth/register responds with 201 and data structure on valid input', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Valid User',
        email: 'valid@example.com',
        password: 'ValidPassword123!',
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data).toHaveProperty('token');
    });

    it('POST /api/v1/auth/login responds with 200 and data structure on valid input', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'valid@example.com',
        password: 'ValidPassword123!',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data).toHaveProperty('token');
    });

    it('GET /api/v1/auth/me rejects with 401 when Authorization header is missing', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('GET /api/v1/auth/me rejects with 401 on invalid Bearer token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('GET /api/v1/auth/me returns 200 and user profile when valid token provided', async () => {
      const { token } = await signAccessToken({
        sub: 'u1',
        role: Role.OPERATOR,
        email: 'u1@example.com',
        name: 'User One',
      });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.user).toMatchObject({
        id: 'u1',
        email: 'u1@example.com',
        name: 'User One',
        role: 'OPERATOR',
      });
    });

    it('POST /api/v1/auth/logout rejects with 401 when Authorization header is missing', async () => {
      const res = await request(app).post('/api/v1/auth/logout');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('POST /api/v1/auth/logout returns 200 with success message on valid session', async () => {
      const { token } = await signAccessToken({
        sub: 'u1',
        role: Role.OPERATOR,
        email: 'u1@example.com',
        name: 'User One',
      });

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('Logged out successfully');
    });
  });
});
