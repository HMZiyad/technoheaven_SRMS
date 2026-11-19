import { Request } from 'express';
export { Role, Status, Priority, Category } from '@prisma/client';
import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  role: Role;
  email?: string;
  name?: string;
  jti: string;
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  id: string;
  role: Role;
  email: string;
  name: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
  requestId?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
