import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { config } from './config';
import { logger } from './utils/logger';
import { getPrismaClient, disconnectPrisma } from './db/prisma';
import { disconnectRedis } from './db/redis';
import { redisConnection } from './queue/connection';
import { QUEUE_NAME, ProcessJobData } from './queue/producer';
import { runPipeline, CancelledError } from './queue/pipeline';
import { startReconciler, stopReconciler } from './queue/reconciler';
import { eventPublisher } from './realtime/eventPublisher';
import { Status } from './types';

/**
 * Handles transition to CANCELLED state in DB and publishes domain event.
 */
async function handleCancellation(
  requestId: string,
  createdById: string,
  fromStatus: Status = Status.IN_PROGRESS,
): Promise<void> {
  const prisma = getPrismaClient();
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.serviceRequest.update({
      where: { id: requestId },
      data: {
        status: Status.CANCELLED,
        completedAt: now,
        version: { increment: 1 },
      },
    });

    await tx.statusHistory.create({
      data: {
        requestId,
        fromStatus,
        toStatus: Status.CANCELLED,
        note: 'Request cancelled during processing',
      },
    });
  });

  try {
    await eventPublisher.publishStatusChanged({
      id: requestId,
      from: fromStatus,
      to: Status.CANCELLED,
      createdById,
    });
  } catch (pubErr) {
    logger.warn({ pubErr, requestId }, 'Failed to publish cancellation status event');
  }

  logger.info({ requestId }, 'Request marked as CANCELLED');
}

/**
 * Core job processor for service requests.
 */
async function processJob(job: Job<ProcessJobData>): Promise<void> {
  const { requestId } = job.data;
  const prisma = getPrismaClient();

  logger.info(
    { jobId: job.id, requestId, attempt: job.attemptsMade + 1 },
    'Worker processing service request job',
  );

  // 1. Load request from DB
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    logger.warn({ requestId }, 'Request not found in DB, skipping job');
    return;
  }

  // 2. Guard: check status === Status.QUEUED and !cancelRequested. If not, return
  if (request.status !== Status.QUEUED || request.cancelRequested) {
    logger.info(
      { requestId, status: request.status, cancelRequested: request.cancelRequested },
      'Guard check failed: request is not QUEUED or cancel was already requested',
    );
    if (request.cancelRequested && request.status !== Status.CANCELLED) {
      await handleCancellation(requestId, request.createdById, request.status);
    }
    return;
  }

  // 3. DB transaction: update status to IN_PROGRESS, startedAt = now(), version = version + 1, insert history row
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.serviceRequest.update({
      where: { id: requestId, version: request.version },
      data: {
        status: Status.IN_PROGRESS,
        startedAt: now,
        version: { increment: 1 },
        currentStage: 'Validate',
        progress: 0,
      },
    });

    await tx.statusHistory.create({
      data: {
        requestId,
        fromStatus: Status.QUEUED,
        toStatus: Status.IN_PROGRESS,
        note: `Worker picked up request (attempt ${job.attemptsMade + 1})`,
      },
    });
  });

  // 4. Call eventPublisher.publishStatusChanged(...)
  try {
    await eventPublisher.publishStatusChanged({
      id: requestId,
      from: Status.QUEUED,
      to: Status.IN_PROGRESS,
      createdById: request.createdById,
    });
  } catch (pubErr) {
    logger.warn({ pubErr, requestId }, 'Failed to publish IN_PROGRESS status changed event');
  }

  // 5. Run pipeline stages
  try {
    const result = await runPipeline(requestId, request.createdById);

    if (result.cancelled) {
      await handleCancellation(requestId, request.createdById, Status.IN_PROGRESS);
      return;
    }

    // 6. If pipeline succeeds:
    // DB transaction: update status to COMPLETED, progress = 100, completedAt = now(), insert history row
    const completedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.serviceRequest.update({
        where: { id: requestId },
        data: {
          status: Status.COMPLETED,
          progress: 100,
          currentStage: 'Finalize',
          completedAt,
          version: { increment: 1 },
        },
      });

      await tx.statusHistory.create({
        data: {
          requestId,
          fromStatus: Status.IN_PROGRESS,
          toStatus: Status.COMPLETED,
          note: 'Processing completed successfully',
        },
      });
    });

    // Call eventPublisher.publishStatusChanged(...)
    try {
      await eventPublisher.publishStatusChanged({
        id: requestId,
        from: Status.IN_PROGRESS,
        to: Status.COMPLETED,
        createdById: request.createdById,
      });
    } catch (pubErr) {
      logger.warn({ pubErr, requestId }, 'Failed to publish COMPLETED status changed event');
    }

    logger.info({ requestId }, 'Request completed successfully');
  } catch (err: any) {
    // If cancelled:
    if (err instanceof CancelledError || err?.name === 'CancelledError' || err?.cancelled) {
      await handleCancellation(requestId, request.createdById, Status.IN_PROGRESS);
      return;
    }

    // If error thrown:
    const maxAttempts = job.opts.attempts || 3;
    const currentAttempt = job.attemptsMade + 1;

    logger.error(
      { err, requestId, currentAttempt, maxAttempts },
      'Pipeline execution error during worker processing',
    );

    // If attempts remaining > 1, let BullMQ retry
    // If final attempt exhausted: DB transaction: update status to FAILED, failureReason = err.message, insert history row, call eventPublisher.publishStatusChanged(...)
    if (currentAttempt >= maxAttempts) {
      const failureReason = err?.message || 'Processing failed after all retry attempts';

      await prisma.$transaction(async (tx) => {
        await tx.serviceRequest.update({
          where: { id: requestId },
          data: {
            status: Status.FAILED,
            failureReason,
            completedAt: new Date(),
            version: { increment: 1 },
          },
        });

        await tx.statusHistory.create({
          data: {
            requestId,
            fromStatus: Status.IN_PROGRESS,
            toStatus: Status.FAILED,
            note: `Processing permanently failed after attempt ${currentAttempt}/${maxAttempts}: ${failureReason}`,
          },
        });
      });

      try {
        await eventPublisher.publishStatusChanged({
          id: requestId,
          from: Status.IN_PROGRESS,
          to: Status.FAILED,
          createdById: request.createdById,
        });
      } catch (pubErr) {
        logger.warn({ pubErr, requestId }, 'Failed to publish FAILED status changed event');
      }

      logger.warn(
        { requestId, currentAttempt, maxAttempts },
        'Request permanently failed: all retry attempts exhausted',
      );
    } else {
      // Record attempt count in DB
      await prisma.serviceRequest
        .update({
          where: { id: requestId },
          data: {
            attempts: { increment: 1 },
          },
        })
        .catch(() => {});
    }

    // Rethrow to let BullMQ track attempt and apply exponential backoff
    throw err;
  }
}

// Create BullMQ Worker on queue 'service-requests' with concurrency: config.WORKER_CONCURRENCY
export const worker = new Worker<ProcessJobData>(QUEUE_NAME, processJob, {
  connection: redisConnection,
  concurrency: config.WORKER_CONCURRENCY,
});

// Event handlers
worker.on('completed', (job: Job) => {
  logger.info({ jobId: job.id, requestId: job.data?.requestId }, 'BullMQ job completed');
});

worker.on('failed', async (job: Job | undefined, err: Error) => {
  if (!job) {
    logger.error({ err }, 'BullMQ worker job failed (job undefined)');
    return;
  }
  const maxAttempts = job.opts.attempts || 3;
  logger.warn(
    {
      jobId: job.id,
      requestId: job.data?.requestId,
      attemptsMade: job.attemptsMade,
      maxAttempts,
      err: err.message,
    },
    'BullMQ job attempt failed',
  );

  // Fallback safeguard for final failure
  if (job.attemptsMade >= maxAttempts && job.data?.requestId) {
    const prisma = getPrismaClient();
    const req = await prisma.serviceRequest.findUnique({
      where: { id: job.data.requestId },
    });
    if (
      req &&
      req.status !== Status.FAILED &&
      req.status !== Status.CANCELLED &&
      req.status !== Status.COMPLETED
    ) {
      await prisma.$transaction(async (tx) => {
        await tx.serviceRequest.update({
          where: { id: req.id },
          data: {
            status: Status.FAILED,
            failureReason: err.message || 'Worker retry attempts exhausted',
            completedAt: new Date(),
            version: { increment: 1 },
          },
        });
        await tx.statusHistory.create({
          data: {
            requestId: req.id,
            fromStatus: req.status,
            toStatus: Status.FAILED,
            note: `Worker retry exhausted: ${err.message}`,
          },
        });
      });

      try {
        await eventPublisher.publishStatusChanged({
          id: req.id,
          from: req.status,
          to: Status.FAILED,
          createdById: req.createdById,
        });
      } catch {
        // ignore
      }
    }
  }
});

worker.on('error', (err: Error) => {
  logger.error({ err }, 'BullMQ Worker system error');
});

async function main() {
  logger.info(
    {
      concurrency: config.WORKER_CONCURRENCY,
      queue: QUEUE_NAME,
      failureProbability: config.FAILURE_PROBABILITY,
    },
    'Worker process starting...',
  );

  // Start background reconciler
  const reconcilerTimer = startReconciler();

  logger.info('Worker ready and listening for service request jobs');

  async function shutdown(signal: string) {
    logger.info({ signal }, 'Worker shutting down gracefully...');
    stopReconciler(reconcilerTimer);
    await worker.close();
    await disconnectPrisma();
    await disconnectRedis();
    logger.info('Worker shutdown complete');
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Worker process failed to start');
  process.exit(1);
});
