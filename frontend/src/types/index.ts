export enum Role {
  OPERATOR = 'OPERATOR',
  SUPERVISOR = 'SUPERVISOR',
  ADMIN = 'ADMIN',
}

export enum Status {
  SUBMITTED = 'SUBMITTED',
  QUEUED = 'QUEUED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum Category {
  TECHNICAL = 'TECHNICAL',
  BILLING = 'BILLING',
  GENERAL = 'GENERAL',
  MAINTENANCE = 'MAINTENANCE',
  EMERGENCY = 'EMERGENCY',
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  role: Role;
  email: string;
  name: string;
}

export interface StatusHistory {
  id: string | number;
  requestId: string;
  fromStatus?: Status | null;
  toStatus: Status;
  changedById?: string | null;
  note?: string | null;
  createdAt: string;
  changedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface Comment {
  id: string;
  requestId: string;
  authorId: string;
  body: string;
  createdAt: string;
  author?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface ServiceRequest {
  id: string;
  reference: string;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  status: Status;
  progress: number;
  currentStage?: string | null;
  customerName: string;
  customerContact: string;
  createdById: string;
  assignedToId?: string | null;
  idempotencyKey?: string | null;
  version: number;
  attempts: number;
  failureReason?: string | null;
  cancelRequested: boolean;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  } | null;
  history?: StatusHistory[];
  comments?: Comment[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface StatsSummary {
  byStatus: Record<Status | string, number>;
  byPriority: Record<Priority | string, number>;
  byCategory?: Record<Category | string, number>;
  topCustomers?: { name: string; count: number }[];
  total: number;
  avgProcessingTimeMs: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export enum DomainEventType {
  REQUEST_CREATED = 'request:created',
  REQUEST_STATUS_CHANGED = 'request:status_changed',
  REQUEST_PROGRESS = 'request:progress',
  REQUEST_UPDATED = 'request:updated',
  REQUEST_COMMENT_ADDED = 'request:comment_added',
  STATS_UPDATED = 'stats:updated',
}

export interface EventEnvelope<T = any> {
  id: string;
  type: DomainEventType | string;
  requestId?: string;
  targetUserId?: string;
  audience: 'supervisor' | 'user' | 'all' | 'room';
  payload: T;
  timestamp: string;
}
