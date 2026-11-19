import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { AuthRequest, Role } from '../types';
import { getPrismaClient } from '../db/prisma';
import { ValidationError } from '../utils/errors';

if (typeof BigInt !== 'undefined' && !(BigInt.prototype as any).toJSON) {
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };
}

export const eventRouter = Router();

/**
 * GET /events
 * Reconnect synchronization endpoint.
 * Fetches domain events that occurred after the given `since` event ID.
 * When more than 500 events are pending, returns gapTooLarge: true to prompt full refresh.
 */
eventRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthRequest).user!;
    const sinceQuery = req.query.since;
    let since = BigInt(0);

    if (sinceQuery !== undefined && sinceQuery !== '') {
      try {
        since = BigInt(String(sinceQuery));
        if (since < 0n) {
          since = BigInt(0);
        }
      } catch {
        throw new ValidationError('Invalid since parameter; must be a valid integer or BigInt string');
      }
    }

    const prisma = getPrismaClient();

    // Check how many events exist after `since`
    const count = await prisma.domainEvent.count({
      where: {
        id: { gt: since },
      },
    });

    if (count > 500) {
      return res.status(200).json({
        gapTooLarge: true,
        events: [],
        data: [],
      });
    }

    const events = await prisma.domainEvent.findMany({
      where: {
        id: { gt: since },
      },
      orderBy: {
        id: 'asc',
      },
      include: {
        request: {
          select: {
            createdById: true,
          },
        },
      },
    });

    // If user is OPERATOR, filter events where event.payload.createdById === user.id or request is theirs
    let filtered = events;
    if (user.role === Role.OPERATOR) {
      filtered = events.filter((e) => {
        const payload = e.payload as any;
        const isPayloadOwner =
          payload?.createdById === user.id ||
          payload?.targetUserId === user.id ||
          payload?.ownerId === user.id;
        const isRequestOwner = e.request?.createdById === user.id;
        return Boolean(isPayloadOwner || isRequestOwner);
      });
    }

    const formattedEvents = filtered.map((e) => ({
      id: String(e.id),
      type: e.type,
      requestId: e.requestId ?? undefined,
      payload: e.payload,
      createdAt: e.createdAt.toISOString(),
      timestamp: e.createdAt.toISOString(),
    }));

    return res.status(200).json({
      gapTooLarge: false,
      data: formattedEvents,
      events: formattedEvents,
    });
  } catch (err) {
    next(err);
  }
});
