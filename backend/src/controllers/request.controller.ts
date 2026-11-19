import { NextFunction, Request, Response, Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { requestService } from '../services/request.service';
import { AuthRequest, Role, Status } from '../types';
import {
  createRequestSchema,
  listRequestsQuerySchema,
  updateRequestSchema,
} from '../validators/request.validator';

export const requestRouter = Router();

requestRouter.post(
  '/',
  authenticate,
  validate(createRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idempotencyKey =
        (req.header('idempotency-key') || req.header('Idempotency-Key')) ?? undefined;
      const user = (req as AuthRequest).user!;
      const request = await requestService.createRequest(user, req.body, idempotencyKey);
      res.status(201).json({ data: request });
    } catch (err) {
      next(err);
    }
  },
);

requestRouter.get(
  '/',
  authenticate,
  validate(listRequestsQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthRequest).user!;
      const result = await requestService.listRequests(user, req.query as any);
      res.status(200).json({ data: result.requests, meta: result.meta });
    } catch (err) {
      next(err);
    }
  },
);

requestRouter.get(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthRequest).user!;
      const request = await requestService.getRequestById(user, req.params.id);
      res.status(200).json({ data: request });
    } catch (err) {
      next(err);
    }
  },
);

requestRouter.patch(
  '/:id',
  authenticate,
  requireRole(Role.SUPERVISOR, Role.ADMIN),
  validate(updateRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthRequest).user!;
      const request = await requestService.updateRequest(user, req.params.id, req.body);
      res.status(200).json({ data: request });
    } catch (err) {
      next(err);
    }
  },
);

requestRouter.post(
  '/:id/cancel',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthRequest).user!;
      const result = await requestService.cancelRequest(user, req.params.id);
      const statusCode = result.status === Status.IN_PROGRESS ? 202 : 200;
      res.status(statusCode).json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

requestRouter.post(
  '/:id/retry',
  authenticate,
  requireRole(Role.SUPERVISOR, Role.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthRequest).user!;
      const request = await requestService.retryRequest(user, req.params.id);
      res.status(200).json({ data: request });
    } catch (err) {
      next(err);
    }
  },
);

requestRouter.get(
  '/:id/history',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthRequest).user!;
      const history = await requestService.getRequestHistory(user, req.params.id);
      res.status(200).json({ data: history });
    } catch (err) {
      next(err);
    }
  },
);

export default requestRouter;
