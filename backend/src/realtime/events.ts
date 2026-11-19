/**
 * Realtime domain event definitions and envelope types for SRMS.
 */

export enum DomainEventType {
  REQUEST_CREATED = 'request:created',
  REQUEST_STATUS_CHANGED = 'request:status_changed',
  REQUEST_PROGRESS = 'request:progress',
  REQUEST_UPDATED = 'request:updated',
  REQUEST_COMMENT_ADDED = 'request:comment_added',
  STATS_UPDATED = 'stats:updated',
}

export type EventAudience = 'supervisor' | 'user' | 'all' | 'room';

export interface EventEnvelope<T = any> {
  id: string;
  type: DomainEventType;
  requestId?: string;
  targetUserId?: string;
  audience: 'supervisor' | 'user' | 'all' | 'room';
  payload: T;
  timestamp: string;
}
