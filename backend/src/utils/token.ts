import { SignJWT, jwtVerify } from 'jose';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { Role, JwtPayload } from '../types';

function parseDurationToSeconds(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])?$/i);
  if (!match) return 900;
  const value = parseInt(match[1], 10);
  const unit = (match[2] || 's').toLowerCase();
  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      return value;
  }
}

export async function signAccessToken(payload: {
  sub: string;
  role: Role;
  email: string;
  name: string;
}): Promise<{ token: string; jti: string; expiresIn: number }> {
  const jti = uuidv4();
  const secret = new TextEncoder().encode(config.JWT_SECRET);
  const expiresIn = parseDurationToSeconds(config.JWT_EXPIRES_IN);

  const token = await new SignJWT({
    role: payload.role,
    email: payload.email,
    name: payload.name,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(config.JWT_EXPIRES_IN)
    .sign(secret);

  return { token, jti, expiresIn };
}

export async function verifyAccessToken(token: string): Promise<JwtPayload> {
  const secret = new TextEncoder().encode(config.JWT_SECRET);
  const { payload } = await jwtVerify(token, secret);

  return {
    sub: payload.sub as string,
    role: payload.role as Role,
    jti: payload.jti as string,
    iat: payload.iat,
    exp: payload.exp,
  };
}
