import { Request, Response } from 'express';
import { AuthRequest } from '../types';

export function notFound(req: Request, res: Response) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
      requestId: (req as AuthRequest).requestId,
    },
  });
}
