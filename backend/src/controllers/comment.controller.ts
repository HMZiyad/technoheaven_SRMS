import { NextFunction, Request, Response, Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { commentService } from '../services/comment.service';
import { AuthRequest } from '../types';
import { commentSchema } from '../validators/request.validator';

export const commentRouter = Router({ mergeParams: true });

commentRouter.post(
  ['/requests/:id/comments', '/:id/comments'],
  authenticate,
  validate(commentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthRequest).user!;
      const comment = await commentService.addComment(user, req.params.id, req.body.body);
      res.status(201).json({ data: comment });
    } catch (err) {
      next(err);
    }
  },
);

commentRouter.get(
  ['/requests/:id/comments', '/:id/comments'],
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthRequest).user!;
      const comments = await commentService.getComments(user, req.params.id);
      res.status(200).json({ data: comments });
    } catch (err) {
      next(err);
    }
  },
);

export default commentRouter;
