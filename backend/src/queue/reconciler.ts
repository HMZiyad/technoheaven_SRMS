import { getPrismaClient } from '../db/prisma';
import { Status } from '../types';
import { logger } from '../utils/logger';
import { queueProducer } from './producer';
import { eventPublisher } from '../realtime/eventPublisher';

/**
 * Reconciles stuck service requests:
 * 1. Requests stuck in IN_PROGRESS older than 5 minutes -> mark FAILED with 'Worker timeout / lost'
 * 2. Requests stuck in SUBMITTED older than 2 minutes -> transition to QUEUED and enqueue
 */
export async function reconcile(): Promise<{ failedCount: number; enqueuedCount: number }> {
  const prisma = getPrismaClient();
  let failedCount = 0;
  let enqueuedCount = 0;

  try {
    const now = Date.now();
    const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);
    const twoMinutesAgo = new Date(now - 2 * 60 * 1000);

    // 1. Find requests stuck in IN_PROGRESS older than 5 minutes
    const stuckInProgress = await prisma.serviceRequest.findMany({
      where: {
        status: Status.IN_PROGRESS,
        updatedAt: { lte: fiveMinutesAgo },
      },
    });

    for (const req of stuckInProgress) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.serviceRequest.update({
            where: { id: req.id },
            data: {
              status: Status.FAILED,
              failureReason: 'Worker timeout / lost',
              completedAt: new Date(),
              version: { increment: 1 },
            },
          });

          await tx.statusHistory.create({
            data: {
              requestId: req.id,
              fromStatus: Status.IN_PROGRESS,
              toStatus: Status.FAILED,
              note: 'Worker timeout / lost',
            },
          });
        });

        try {
          await eventPublisher.publishStatusChanged({
            id: req.id,
            from: Status.IN_PROGRESS,
            to: Status.FAILED,
            createdById: req.createdById,
          });
        } catch (pubErr) {
          logger.warn({ pubErr, requestId: req.id }, 'Reconciler failed to publish status changed event');
        }

        failedCount++;
        logger.warn(
          { requestId: req.id, updatedAt: req.updatedAt },
          'Reconciler marked stuck IN_PROGRESS request as FAILED',
        );
      } catch (err) {
        logger.error({ err, requestId: req.id }, 'Error reconciling stuck IN_PROGRESS request');
      }
    }

    // 2. Find requests stuck in SUBMITTED older than 2 minutes
    const stuckSubmitted = await prisma.serviceRequest.findMany({
      where: {
        status: Status.SUBMITTED,
        createdAt: { lte: twoMinutesAgo },
      },
    });

    for (const req of stuckSubmitted) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.serviceRequest.update({
            where: { id: req.id },
            data: {
              status: Status.QUEUED,
              version: { increment: 1 },
            },
          });

          await tx.statusHistory.create({
            data: {
              requestId: req.id,
              fromStatus: Status.SUBMITTED,
              toStatus: Status.QUEUED,
              note: 'Reconciled and enqueued',
            },
          });
        });

        // Enqueue to BullMQ
        await queueProducer.enqueue(req.id, req.priority);

        try {
          await eventPublisher.publishStatusChanged({
            id: req.id,
            from: Status.SUBMITTED,
            to: Status.QUEUED,
            createdById: req.createdById,
          });
        } catch (pubErr) {
          logger.warn({ pubErr, requestId: req.id }, 'Reconciler failed to publish status changed event');
        }

        enqueuedCount++;
        logger.info(
          { requestId: req.id, priority: req.priority, createdAt: req.createdAt },
          'Reconciler enqueued stuck SUBMITTED request',
        );
      } catch (err) {
        logger.error({ err, requestId: req.id }, 'Error reconciling stuck SUBMITTED request');
      }
    }

    // 3. Find requests stuck in QUEUED older than 1 minute where no job exists in BullMQ
    const stuckQueued = await prisma.serviceRequest.findMany({
      where: {
        status: Status.QUEUED,
        updatedAt: { lte: new Date(now - 60 * 1000) },
      },
    });

    for (const req of stuckQueued) {
      try {
        const job = await queueProducer.queue.getJob(req.id);
        const isActiveOrWaiting = job
          ? (await job.isActive()) || (await job.isWaiting()) || (await job.isDelayed())
          : false;

        if (!isActiveOrWaiting) {
          if (job) {
            await job.remove().catch(() => {});
          }
          await queueProducer.enqueue(req.id, req.priority);
          enqueuedCount++;
          logger.info(
            { requestId: req.id, priority: req.priority },
            'Reconciler re-enqueued orphaned QUEUED request',
          );
        }
      } catch (err) {
        logger.error({ err, requestId: req.id }, 'Error reconciling orphaned QUEUED request');
      }
    }
  } catch (err) {
    logger.error({ err }, 'Error in reconciler sweep');
  }

  return { failedCount, enqueuedCount };
}

/**
 * Starts the background reconciler on a 60-second interval.
 * Returns the NodeJS.Timeout timer for cleanup.
 */
export function startReconciler(intervalMs = 60000): NodeJS.Timeout {
  logger.info({ intervalMs }, 'Starting queue reconciler');
  const timer = setInterval(() => {
    reconcile().catch((err) => {
      logger.error({ err }, 'Unhandled error in scheduled reconciliation');
    });
  }, intervalMs);

  return timer;
}

export function stopReconciler(timer?: NodeJS.Timeout): void {
  if (timer) {
    clearInterval(timer);
    logger.info('Queue reconciler stopped');
  }
}

export const reconciler = {
  reconcile,
  startReconciler,
  stopReconciler,
};

export default reconciler;
