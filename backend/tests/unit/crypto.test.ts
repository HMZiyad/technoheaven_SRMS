import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, dummyHash } from '../../src/utils/crypto';

describe('Unit: Crypto Utility', () => {
  const password = 'CorrectHorseBatteryStaple123!';

  describe('hashPassword', () => {
    it('produces a valid argon2id hash', async () => {
      const hash = await hashPassword(password);

      expect(typeof hash).toBe('string');
      expect(hash.startsWith('$argon2id$')).toBe(true);
    });

    it('generates different salts for identical passwords', async () => {
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
      expect(hash1.startsWith('$argon2id$')).toBe(true);
      expect(hash2.startsWith('$argon2id$')).toBe(true);
    });
  });

  describe('verifyPassword', () => {
    it('returns true for matching password and hash', async () => {
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('returns false for mismatched password', async () => {
      const hash = await hashPassword(password);
      const isValid = await verifyPassword('WrongPassword999!', hash);

      expect(isValid).toBe(false);
    });

    it('returns false for malformed hash without throwing', async () => {
      const isValid = await verifyPassword(password, 'not-a-valid-argon-hash');

      expect(isValid).toBe(false);
    });

    it('returns false for empty hash or empty password', async () => {
      const hash = await hashPassword(password);
      expect(await verifyPassword('', hash)).toBe(false);
      expect(await verifyPassword(password, '')).toBe(false);
    });
  });

  describe('dummyHash', () => {
    it('completes execution without throwing an error', async () => {
      await expect(dummyHash()).resolves.toBeUndefined();
    });
  });
});
