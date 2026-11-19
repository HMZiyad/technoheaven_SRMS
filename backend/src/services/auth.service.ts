import { Role, AuthUser } from '../types';
import { ConflictError, AuthenticationError, NotFoundError } from '../utils/errors';
import { hashPassword, verifyPassword, dummyHash } from '../utils/crypto';
import { signAccessToken } from '../utils/token';
import { userRepository } from '../repositories/user.repository';
import { getRedisClient } from '../db/redis';

export async function register(data: {
  name: string;
  email: string;
  password: string;
}): Promise<{ user: AuthUser; token: string }> {
  const existing = await userRepository.findByEmail(data.email);
  if (existing) {
    throw new ConflictError('Email already registered');
  }

  const passwordHash = await hashPassword(data.password);
  const created = await userRepository.createUser({
    name: data.name,
    email: data.email,
    passwordHash,
    role: Role.OPERATOR,
  });

  const { token } = await signAccessToken({
    sub: created.id,
    role: created.role as Role,
    email: created.email,
    name: created.name,
  });

  const user: AuthUser = {
    id: created.id,
    role: created.role as Role,
    email: created.email,
    name: created.name,
  };

  return { user, token };
}

export async function login(data: {
  email: string;
  password: string;
}): Promise<{ user: AuthUser; token: string }> {
  const userRecord = await userRepository.findByEmail(data.email);
  if (!userRecord) {
    await dummyHash();
    throw new AuthenticationError('Invalid email or password');
  }

  if (userRecord.active === false) {
    throw new AuthenticationError('Account has been deactivated');
  }

  const isValid = await verifyPassword(data.password, userRecord.passwordHash);
  if (!isValid) {
    throw new AuthenticationError('Invalid email or password');
  }

  const { token } = await signAccessToken({
    sub: userRecord.id,
    role: userRecord.role as Role,
    email: userRecord.email,
    name: userRecord.name,
  });

  const user: AuthUser = {
    id: userRecord.id,
    role: userRecord.role as Role,
    email: userRecord.email,
    name: userRecord.name,
  };

  return { user, token };
}

export async function logout(jti: string, expSeconds = 900): Promise<void> {
  const redis = getRedisClient();
  await redis.setex(`token:denylist:${jti}`, expSeconds, '1');
}

export async function isTokenRevoked(jti: string): Promise<boolean> {
  const redis = getRedisClient();
  const exists = await redis.exists(`token:denylist:${jti}`);
  return exists === 1;
}

export async function getMe(userId: string): Promise<AuthUser> {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new NotFoundError('User');
  }

  return {
    id: user.id,
    role: user.role as Role,
    email: user.email,
    name: user.name,
  };
}

export const authService = {
  register,
  login,
  logout,
  isTokenRevoked,
  getMe,
};
