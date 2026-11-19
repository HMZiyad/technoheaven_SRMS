import { describe, it, expect } from 'vitest';
import { SignJWT } from 'jose';
import { signAccessToken, verifyAccessToken } from '../../src/utils/token';
import { Role } from '../../src/types';

describe('Unit: Token Utility', () => {
  const testPayload = {
    sub: '123e4567-e89b-12d3-a456-426614174000',
    role: Role.OPERATOR,
    email: 'operator@srms.local',
    name: 'Operator User',
  };

  it('signAccessToken returns valid token, jti, and expiresIn', async () => {
    const result = await signAccessToken(testPayload);

    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('jti');
    expect(result).toHaveProperty('expiresIn');

    expect(typeof result.token).toBe('string');
    expect(result.token.split('.')).toHaveLength(3);

    expect(typeof result.jti).toBe('string');
    expect(result.jti).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    expect(typeof result.expiresIn).toBe('number');
    expect(result.expiresIn).toBeGreaterThan(0);
  });

  it('verifyAccessToken decodes sub, role, email, name, and jti', async () => {
    const { token, jti } = await signAccessToken(testPayload);
    const decoded = await verifyAccessToken(token);

    expect(decoded.sub).toBe(testPayload.sub);
    expect(decoded.role).toBe(testPayload.role);
    expect(decoded.email).toBe(testPayload.email);
    expect(decoded.name).toBe(testPayload.name);
    expect(decoded.jti).toBe(jti);
    expect(typeof decoded.iat).toBe('number');
    expect(typeof decoded.exp).toBe('number');
    expect(decoded.exp!).toBeGreaterThan(decoded.iat!);
  });

  describe('verifyAccessToken failure scenarios', () => {
    it('throws error on tampered token signature', async () => {
      const { token } = await signAccessToken(testPayload);
      const parts = token.split('.');
      // Tamper signature
      const tampered = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -4)}xxxx`;

      await expect(verifyAccessToken(tampered)).rejects.toThrow();
    });

    it('throws error on tampered token payload', async () => {
      const { token } = await signAccessToken(testPayload);
      const parts = token.split('.');
      // Tamper payload
      const tamperedPayload = Buffer.from(
        JSON.stringify({ sub: 'hacked-id', role: Role.ADMIN }),
      ).toString('base64url');
      const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      await expect(verifyAccessToken(tampered)).rejects.toThrow();
    });

    it('throws error on malformed or empty token', async () => {
      await expect(verifyAccessToken('')).rejects.toThrow();
      await expect(verifyAccessToken('invalid.token')).rejects.toThrow();
      await expect(verifyAccessToken('random-string-not-jwt')).rejects.toThrow();
    });

    it('throws error on token signed with different secret', async () => {
      const wrongSecret = new TextEncoder().encode('another-very-long-secret-key-32-chars-long!');
      const foreignToken = await new SignJWT({
        sub: testPayload.sub,
        role: testPayload.role,
        email: testPayload.email,
        name: testPayload.name,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('15m')
        .sign(wrongSecret);

      await expect(verifyAccessToken(foreignToken)).rejects.toThrow();
    });
  });
});
