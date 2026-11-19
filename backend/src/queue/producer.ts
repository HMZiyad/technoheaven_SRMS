import { Queue, Job } from 'bullmq';
import { Priority } from '../types';
import { redisConnection } from './connection';
import { logger } from '../utils/logger';

export const QUEUE_NAME = 'service-requests';

export const PRIORITY_MAP: Record<Priority, number> = {
  [Priority.URGENT]: 1,
  [Priority.HIGH]: 2,
  [Priority.MEDIUM]: 3,
  [Priority.LOW]: 4,
};

export interface ProcessJobData {
  requestId: string;
}

export const requestQueue = new Queue<ProcessJobData>(QUEUE_NAME, {
  connection: redisConnection,
});

export async function enqueue(
  requestId: string,
  priority: Priority = Priority.MEDIUM,
): Promise<Job<ProcessJobData>> {
  const numericPriority = PRIORITY_MAP[priority] ?? PRIORITY_MAP[Priority.MEDIUM];

  const job = await requestQueue.add(
    'process-request',
    { requestId },
    {
      jobId: requestId,
      priority: numericPriority,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  );

  logger.info(
    { jobId: job.id, requestId, priority, numericPriority },
    'Job enqueued to service-requests',
  );

  return job;
}

export async function removeJob(requestId: string): Promise<boolean> {
  const job = await requestQueue.getJob(requestId);
  if (job) {
    await job.remove();
    logger.info({ jobId: requestId }, 'Job removed from queue');
    return true;
  }
  return false;
}

export async function close(): Promise<void> {
  await requestQueue.close();
  logger.info('Queue producer closed');
}

export const queueProducer = {
  queue: requestQueue,
  enqueue,
  removeJob,
  close,
};

export default queueProducer;
