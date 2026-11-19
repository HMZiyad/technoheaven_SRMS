import { getPrismaClient } from '../db/prisma';
import { config } from '../config';
import { logger } from '../utils/logger';
import { eventPublisher } from '../realtime/eventPublisher';

export class CancelledError extends Error {
  readonly cancelled = true;
  constructor(message = 'Request processing cancelled') {
    super(message);
    this.name = 'CancelledError';
  }
}

export interface PipelineStage {
  name: string;
  progress: number;
}

export const PIPELINE_STAGES: PipelineStage[] = [
  { name: 'Validate', progress: 25 },
  { name: 'Allocate', progress: 50 },
  { name: 'Process', progress: 85 },
  { name: 'Finalize', progress: 100 },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs the staged simulation pipeline for a service request:
 * 1. Validate (0-25%)
 * 2. Allocate (25-50%)
 * 3. Process (50-85%) - failure probability check
 * 4. Finalize (85-100%)
 *
 * Checks cancel_requested between stages and updates DB + publishes progress.
 */
export async function runPipeline(
  requestId: string,
  createdById: string,
): Promise<{ success: boolean; cancelled?: boolean }> {
  const prisma = getPrismaClient();

  for (const stage of PIPELINE_STAGES) {
    // Query DB for current cancel_requested
    const current = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: { cancelRequested: true, status: true },
    });

    if (!current || current.cancelRequested) {
      logger.info({ requestId, stage: stage.name }, 'Pipeline aborted: cancellation requested');
      throw new CancelledError(`Request ${requestId} was cancelled before stage ${stage.name}`);
    }

    // Update DB progress and currentStage
    await prisma.serviceRequest.update({
      where: { id: requestId },
      data: {
        currentStage: stage.name,
        progress: stage.progress,
      },
    });

    // Call eventPublisher.publishProgress({ id: requestId, progress, stage, createdById })
    try {
      await eventPublisher.publishProgress({
        id: requestId,
        progress: stage.progress,
        stage: stage.name,
        createdById,
      });
    } catch (pubErr) {
      logger.warn({ pubErr, requestId, stage: stage.name }, 'Failed to publish progress event');
    }

    // Simulated async delay (500ms - 1500ms per stage)
    const delayMs = Math.floor(Math.random() * 1000) + 500;
    await sleep(delayMs);

    // In Process stage: check Math.random() < config.FAILURE_PROBABILITY
    if (stage.name === 'Process') {
      if (Math.random() < config.FAILURE_PROBABILITY) {
        logger.warn(
          { requestId },
          'Simulated processing failure during computation in Process stage',
        );
        throw new Error('Simulated processing failure during computation');
      }
    }

    // Check cancel_requested again after stage delay
    const afterStage = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: { cancelRequested: true },
    });

    if (afterStage?.cancelRequested) {
      logger.info(
        { requestId, stage: stage.name },
        'Pipeline aborted: cancellation requested after stage delay',
      );
      throw new CancelledError(`Request ${requestId} was cancelled after stage ${stage.name}`);
    }
  }

  return { success: true };
}

export const pipeline = {
  runPipeline,
  CancelledError,
  PIPELINE_STAGES,
};

export default pipeline;
