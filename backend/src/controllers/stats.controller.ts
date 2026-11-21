import { NextFunction, Request, Response, Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { statsService } from '../services/stats.service';
import { AuthRequest, Role } from '../types';

export const statsRouter = Router();

statsRouter.get(
  ['/', '/stats'],
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthRequest).user!;
      const stats = await statsService.getStats(user);
      res.status(200).json({ data: stats });
    } catch (err) {
      next(err);
    }
  },
);

export default statsRouter;
