import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { AuthRequest } from '../types';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  const requestId = (req as AuthRequest).requestId;

  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details, requestId },
    });
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId }, 'Server error');
    }
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details, requestId },
    });
  }

  logger.error({ err, requestId }, 'Unhandled error');
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', requestId },
  });
}
