import { Prisma, ServiceRequest } from '@prisma/client';
import { getPrismaClient } from '../db/prisma';
import { Category, Priority, Status } from '../types';

export interface CreateRequestData {
  reference: string;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  customerName: string;
  customerContact: string;
  createdById: string;
  idempotencyKey?: string | null;
}

export type ServiceRequestWithUsers = ServiceRequest & {
  createdBy: { id: string; name: string; email: string };
  assignedTo: { id: string; name: string; email: string } | null;
};

export interface RequestFilters {
  status?: Status;
  priority?: Priority;
  category?: Category;
  createdById?: string;
  assignedToId?: string;
  q?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export async function create(
  data: CreateRequestData,
  tx?: Prisma.TransactionClient,
): Promise<ServiceRequest> {
  const client = tx ?? getPrismaClient();
  return client.serviceRequest.create({
    data: {
      reference: data.reference,
      title: data.title,
      description: data.description,
      category: data.category,
      priority: data.priority,
      customerName: data.customerName,
      customerContact: data.customerContact,
      createdById: data.createdById,
      idempotencyKey: data.idempotencyKey ?? null,
      status: Status.SUBMITTED,
    },
  });
}

export async function findById(
  id: string,
  tx?: Prisma.TransactionClient,
): Promise<ServiceRequestWithUsers | null> {
  const client = tx ?? getPrismaClient();
  return client.serviceRequest.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

export async function findByReference(
  reference: string,
  tx?: Prisma.TransactionClient,
): Promise<ServiceRequest | null> {
  const client = tx ?? getPrismaClient();
  return client.serviceRequest.findUnique({
    where: { reference },
  });
}

export async function findByIdempotencyKey(
  createdById: string,
  idempotencyKey: string,
  tx?: Prisma.TransactionClient,
): Promise<ServiceRequest | null> {
  const client = tx ?? getPrismaClient();
  return client.serviceRequest.findFirst({
    where: {
      createdById,
      idempotencyKey,
    },
  });
}

export async function findMany(
  filters: RequestFilters,
  pagination: PaginationOptions,
): Promise<{ requests: ServiceRequest[]; total: number }> {
  const client = getPrismaClient();
  const where: Prisma.ServiceRequestWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.priority) {
    where.priority = filters.priority;
  }
  if (filters.category) {
    where.category = filters.category;
  }
  if (filters.createdById) {
    where.createdById = filters.createdById;
  }
  if (filters.assignedToId) {
    where.assignedToId = filters.assignedToId;
  }

  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q } },
      { description: { contains: filters.q } },
    ];
  }

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) {
      where.createdAt.gte = filters.dateFrom;
    }
    if (filters.dateTo) {
      where.createdAt.lte = filters.dateTo;
    }
  }

  const page = Math.max(1, pagination.page || 1);
  const limit = Math.max(1, Math.min(100, pagination.limit || 20));
  const skip = (page - 1) * limit;
  const take = limit;

  const allowedSortFields = ['createdAt', 'priority', 'status', 'updatedAt'];
  const sort = allowedSortFields.includes(pagination.sort || '') ? pagination.sort! : 'createdAt';
  const order = pagination.order === 'asc' ? 'asc' : 'desc';

  const [total, requests] = await Promise.all([
    client.serviceRequest.count({ where }),
    client.serviceRequest.findMany({
      where,
      skip,
      take,
      orderBy: { [sort]: order },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
  ]);

  return { requests, total };
}

export async function updateWithVersion(
  id: string,
  version: number,
  data: Partial<ServiceRequest>,
  tx?: Prisma.TransactionClient,
): Promise<ServiceRequest | null> {
  const client = tx ?? getPrismaClient();

  const updateData: Prisma.ServiceRequestUpdateManyMutationInput = {
    ...data,
    version: { increment: 1 },
  };
  delete (updateData as any).id;

  const result = await client.serviceRequest.updateMany({
    where: {
      id,
      version,
    },
    data: updateData,
  });

  if (result.count === 0) {
    return null;
  }

  return client.serviceRequest.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

export async function countOpenByUser(
  userId: string,
  tx?: Prisma.TransactionClient,
): Promise<number> {
  const client = tx ?? getPrismaClient();
  return client.serviceRequest.count({
    where: {
      createdById: userId,
      status: {
        in: [Status.SUBMITTED, Status.QUEUED, Status.IN_PROGRESS],
      },
    },
  });
}

export async function getStats(): Promise<{
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  total: number;
  avgProcessingTimeMs: number;
}> {
  const prisma = getPrismaClient();

  const byStatus: Record<string, number> = {
    [Status.SUBMITTED]: 0,
    [Status.QUEUED]: 0,
    [Status.IN_PROGRESS]: 0,
    [Status.COMPLETED]: 0,
    [Status.FAILED]: 0,
    [Status.CANCELLED]: 0,
  };

  const byPriority: Record<string, number> = {
    [Priority.LOW]: 0,
    [Priority.MEDIUM]: 0,
    [Priority.HIGH]: 0,
    [Priority.URGENT]: 0,
  };

  const [total, statusGroups, priorityGroups, completedRequests] = await Promise.all([
    prisma.serviceRequest.count(),
    prisma.serviceRequest.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    prisma.serviceRequest.groupBy({
      by: ['priority'],
      _count: { id: true },
    }),
    prisma.serviceRequest.findMany({
      where: {
        status: Status.COMPLETED,
        startedAt: { not: null },
        completedAt: { not: null },
      },
      select: {
        startedAt: true,
        completedAt: true,
      },
    }),
  ]);

  for (const group of statusGroups) {
    byStatus[group.status] = group._count.id;
  }

  for (const group of priorityGroups) {
    byPriority[group.priority] = group._count.id;
  }

  let avgProcessingTimeMs = 0;
  if (completedRequests.length > 0) {
    const totalMs = completedRequests.reduce((sum, r) => {
      const start = r.startedAt ? r.startedAt.getTime() : 0;
      const end = r.completedAt ? r.completedAt.getTime() : 0;
      return sum + Math.max(0, end - start);
    }, 0);
    avgProcessingTimeMs = Math.round(totalMs / completedRequests.length);
  }

  return {
    byStatus,
    byPriority,
    total,
    avgProcessingTimeMs,
  };
}

export const requestRepository = {
  create,
  findById,
  findByReference,
  findByIdempotencyKey,
  findMany,
  updateWithVersion,
  countOpenByUser,
  getStats,
};

export default requestRepository;
