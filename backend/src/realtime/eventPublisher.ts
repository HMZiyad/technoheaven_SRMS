import { getPrismaClient } from '../db/prisma';
import { getRedisClient } from '../db/redis';
import { DomainEventType, EventEnvelope } from './events';
import { logger } from '../utils/logger';

export const EVENT_CHANNEL = 'srms:events';

// Map storing timestamp of last progress DB persistence per requestId
const lastProgressDbTimes = new Map<string, number>();
// Map storing timestamp of last progress Redis publish per requestId
const lastProgressRedisTimes = new Map<string, number>();

export interface PublishEventOptions<T = any> {
  type: DomainEventType;
  requestId?: string;
  targetUserId?: string;
  audience: 'supervisor' | 'user' | 'all' | 'room';
  payload: T;
}

/**
 * Publishes a domain event across the system.
 * Persists to DB (throttled for progress events) and publishes to Redis channel.
 */
export async function publish<T = any>(event: PublishEventOptions<T>): Promise<EventEnvelope<T>> {
  const redis = getRedisClient();

  // Progress throttling: at most 1 progress event per second per request saved to DB
  if (event.type === DomainEventType.REQUEST_PROGRESS && event.requestId) {
    const now = Date.now();
    const lastDb = lastProgressDbTimes.get(event.requestId) || 0;
    const lastRedis = lastProgressRedisTimes.get(event.requestId) || 0;

    // Skip if too frequent (< 200ms) to prevent Redis flood
    if (now - lastRedis < 200) {
      return {
        id: `throttled-${now}`,
        type: event.type,
        requestId: event.requestId,
        targetUserId: event.targetUserId,
        audience: event.audience,
        payload: event.payload,
        timestamp: new Date().toISOString(),
      };
    }

    // If < 1000ms since last DB save for this request, publish to Redis only
    if (now - lastDb < 1000) {
      lastProgressRedisTimes.set(event.requestId, now);
      const envelope: EventEnvelope<T> = {
        id: `prog-${now}`,
        type: event.type,
        requestId: event.requestId,
        targetUserId: event.targetUserId,
        audience: event.audience,
        payload: event.payload,
        timestamp: new Date().toISOString(),
      };
      await redis.publish(EVENT_CHANNEL, JSON.stringify(envelope));
      return envelope;
    }

    // >= 1000ms: record timestamp and continue to DB persistence
    lastProgressDbTimes.set(event.requestId, now);
    lastProgressRedisTimes.set(event.requestId, now);
  }

  // Persist domain event to Prisma DB
  const prisma = getPrismaClient();
  const saved = await prisma.domainEvent.create({
    data: {
      type: event.type,
      requestId: event.requestId ?? null,
      payload: event.payload as any,
    },
  });

  const envelope: EventEnvelope<T> = {
    id: String(saved.id),
    type: event.type,
    requestId: event.requestId,
    targetUserId: event.targetUserId,
    audience: event.audience,
    payload: event.payload,
    timestamp: saved.createdAt.toISOString(),
  };

  // Publish envelope to Redis pub/sub channel
  await redis.publish(EVENT_CHANNEL, JSON.stringify(envelope));
  logger.debug({ eventType: event.type, eventId: envelope.id }, 'Published domain event');

  return envelope;
}

export async function publishRequestCreated(request: any): Promise<EventEnvelope> {
  return publish({
    type: DomainEventType.REQUEST_CREATED,
    requestId: request?.id,
    targetUserId: request?.createdById,
    audience: 'all',
    payload: request,
  });
}

export async function publishStatusChanged(data: {
  id: string;
  from?: string | null;
  to: string;
  changedById?: string | null;
  createdById: string;
}): Promise<EventEnvelope> {
  return publish({
    type: DomainEventType.REQUEST_STATUS_CHANGED,
    requestId: data.id,
    targetUserId: data.createdById,
    audience: 'all',
    payload: data,
  });
}

export async function publishProgress(data: {
  id: string;
  progress: number;
  stage: string;
  createdById: string;
}): Promise<EventEnvelope> {
  return publish({
    type: DomainEventType.REQUEST_PROGRESS,
    requestId: data.id,
    targetUserId: data.createdById,
    audience: 'room',
    payload: data,
  });
}

export async function publishRequestUpdated(request: any): Promise<EventEnvelope> {
  return publish({
    type: DomainEventType.REQUEST_UPDATED,
    requestId: request?.id,
    targetUserId: request?.createdById,
    audience: 'all',
    payload: request,
  });
}

export async function publishCommentAdded(data: {
  requestId: string;
  comment: any;
  createdById: string;
}): Promise<EventEnvelope> {
  return publish({
    type: DomainEventType.REQUEST_COMMENT_ADDED,
    requestId: data.requestId,
    targetUserId: data.createdById,
    audience: 'room',
    payload: data,
  });
}

export async function publishStats(stats: any): Promise<EventEnvelope> {
  return publish({
    type: DomainEventType.STATS_UPDATED,
    audience: 'supervisor',
    payload: stats,
  });
}

export const eventPublisher = {
  publish,
  publishRequestCreated,
  publishStatusChanged,
  publishProgress,
  publishRequestUpdated,
  publishCommentAdded,
  publishStats,
};
