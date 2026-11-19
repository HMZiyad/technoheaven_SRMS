import { Request, Response, NextFunction } from 'express';
import { Role, AuthRequest, JwtPayload } from '../types';
import { AuthenticationError, AuthorizationError } from '../utils/errors';
import { verifyAccessToken } from '../utils/token';
import { authService } from '../services/auth.service';
import { userRepository } from '../repositories/user.repository';

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or malformed authorization header');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new AuthenticationError('Missing or malformed authorization header');
    }

    let payload: JwtPayload;
    try {
      payload = await verifyAccessToken(token);
    } catch {
      throw new AuthenticationError('Invalid or expired token');
    }

    const isRevoked = await authService.isTokenRevoked(payload.jti);
    if (isRevoked) {
      throw new AuthenticationError('Token has been revoked');
    }

    const user = await userRepository.findById(payload.sub);
    if (!user || !user.active) {
      throw new AuthenticationError('User not found or inactive');
    }

    (req as AuthRequest).user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
    };
    (req as any).jti = payload.jti;

    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;
    if (!authReq.user || !roles.includes(authReq.user.role)) {
      return next(new AuthorizationError('Insufficient permissions'));
    }
    next();
  };
}
