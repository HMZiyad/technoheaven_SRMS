import { Router, Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { registerSchema, loginSchema } from '../validators/auth.validator';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimiter';
import { verifyAccessToken } from '../utils/token';
import { AuthRequest } from '../types';

export const authRouter = Router();

const registerLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  keyPrefix: 'auth:register',
});

const loginLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  keyPrefix: 'auth:login',
});

authRouter.post(
  '/register',
  registerLimiter,
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user, token } = await authService.register(req.body);
      res.status(201).json({ data: { user, token } });
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post(
  '/login',
  loginLimiter,
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user, token } = await authService.login(req.body);
      res.status(200).json({ data: { user, token } });
    } catch (err) {
      next(err);
    }
  },
);

authRouter.get(
  '/me',
  authenticate,
  (req: Request, res: Response) => {
    res.status(200).json({ data: { user: (req as AuthRequest).user } });
  },
);

authRouter.post(
  '/logout',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let jti = (req as any).jti;
      if (!jti && req.headers.authorization) {
        const token = req.headers.authorization.slice(7).trim();
        const payload = await verifyAccessToken(token);
        jti = payload.jti;
      }
      if (jti) {
        await authService.logout(jti);
      }
      res.status(200).json({ data: { message: 'Logged out successfully' } });
    } catch (err) {
      next(err);
    }
  },
);
