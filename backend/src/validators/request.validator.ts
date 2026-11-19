import { z } from 'zod';
import { Category, Priority, Status } from '../types';

export const createRequestSchema = z
  .object({
    title: z.string().min(3).max(200),
    description: z.string().min(5).max(5000),
    category: z.nativeEnum(Category),
    priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
    customerName: z.string().min(2).max(100),
    customerContact: z.string().min(3).max(100),
  })
  .strict();

export const updateRequestSchema = z
  .object({
    version: z.number().int().positive(),
    priority: z.nativeEnum(Priority).optional(),
    assignedToId: z.string().uuid().nullable().optional(),
    title: z.string().min(3).max(200).optional(),
    description: z.string().min(5).max(5000).optional(),
  })
  .strict();

export const listRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(Status).optional(),
  priority: z.nativeEnum(Priority).optional(),
  category: z.nativeEnum(Category).optional(),
  assignedToId: z.string().uuid().optional(),
  createdById: z.string().uuid().optional(),
  q: z.string().optional(),
  sort: z.enum(['createdAt', 'priority', 'status', 'updatedAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const commentSchema = z
  .object({
    body: z.string().min(1).max(2000),
  })
  .strict();

export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type UpdateRequestInput = z.infer<typeof updateRequestSchema>;
export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>;
export type CommentInput = z.infer<typeof commentSchema>;
