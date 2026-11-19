import { ServiceRequest, StatusHistory } from '@prisma/client';
import { getPrismaClient } from '../db/prisma';
import { generateReference } from '../db/referenceGenerator';
import { canCancelRequest, canEditRequest, canRetryRequest, canViewRequest } from '../domain/policy';
import { assertTransition, canCancel } from '../domain/stateMachine';
import { historyRepository } from '../repositories/history.repository';
import { requestRepository, ServiceRequestWithUsers } from '../repositories/request.repository';
import { AuthUser, PaginationMeta, Role, Status } from '../types';
import { AuthorizationError, ConflictError, NotFoundError } from '../utils/errors';
import { CreateRequestInput, ListRequestsQuery, UpdateRequestInput } from '../validators/request.validator';

export type ServiceRequestWithDetails = ServiceRequestWithUsers;

export async function createRequest(
  user: AuthUser,
  data: CreateRequestInput,
  idempotencyKey?: string,
): Promise<ServiceRequest> {
  if (idempotencyKey) {
    const existing = await requestRepository.findByIdempotencyKey(user.id, idempotencyKey);
    if (existing) {
      return existing;
    }
  }

  const reference = await generateReference();
  const prisma = getPrismaClient();

  const createdRequest = await prisma.$transaction(async (tx) => {
    const req = await requestRepository.create(
      {
        reference,
        title: data.title,
        description: data.description,
        category: data.category,
        priority: data.priority,
        customerName: data.customerName,
        customerContact: data.customerContact,
        createdById: user.id,
        idempotencyKey: idempotencyKey ?? null,
      },
      tx,
    );

    await historyRepository.create(
      {
        requestId: req.id,
        fromStatus: null,
        toStatus: Status.SUBMITTED,
        changedById: user.id,
        note: 'Request submitted',
      },
      tx,
    );

    return req;
  });

  return createdRequest;
}

export async function listRequests(
  user: AuthUser,
  query: ListRequestsQuery,
): Promise<{ requests: ServiceRequest[]; meta: PaginationMeta }> {
  const createdById = user.role === Role.OPERATOR ? user.id : query.createdById;
  const dateFrom = query.from ? new Date(query.from) : undefined;
  const dateTo = query.to ? new Date(query.to) : undefined;

  const { requests, total } = await requestRepository.findMany(
    {
      status: query.status,
      priority: query.priority,
      category: query.category,
      createdById,
      assignedToId: query.assignedToId,
      q: query.q,
      dateFrom,
      dateTo,
    },
    {
      page: query.page,
      limit: query.limit,
      sort: query.sort,
      order: query.order,
    },
  );

  const totalPages = Math.ceil(total / query.limit) || 1;

  return {
    requests,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages,
    },
  };
}

export async function getRequestById(
  user: AuthUser,
  id: string,
): Promise<ServiceRequestWithDetails> {
  const request = await requestRepository.findById(id);
  if (!request) {
    throw new NotFoundError('ServiceRequest');
  }

  if (!canViewRequest(user, request)) {
    throw new NotFoundError('ServiceRequest');
  }

  return request;
}

export async function updateRequest(
  user: AuthUser,
  id: string,
  data: UpdateRequestInput,
): Promise<ServiceRequest> {
  if (!canEditRequest(user)) {
    throw new AuthorizationError('Insufficient permissions to edit service request');
  }

  const request = await requestRepository.findById(id);
  if (!request) {
    throw new NotFoundError('ServiceRequest');
  }

  if (request.version !== data.version) {
    throw new ConflictError('Version conflict: request was modified by another user. Please reload.');
  }

  const { version, ...updateFields } = data;
  const updated = await requestRepository.updateWithVersion(id, version, updateFields);
  if (!updated) {
    throw new ConflictError('Version conflict: request was modified by another user. Please reload.');
  }

  return updated;
}

export async function cancelRequest(
  user: AuthUser,
  id: string,
): Promise<{ message: string; status: Status }> {
  const request = await requestRepository.findById(id);
  if (!request) {
    throw new NotFoundError('ServiceRequest');
  }

  if (!canCancel(request.status)) {
    throw new ConflictError(`Cannot cancel request in ${request.status} status`);
  }

  if (!canCancelRequest(user, request)) {
    throw new AuthorizationError('Insufficient permissions to cancel this request');
  }

  if (request.status === Status.SUBMITTED || request.status === Status.QUEUED) {
    assertTransition(request.status, Status.CANCELLED);
    const prisma = getPrismaClient();

    return await prisma.$transaction(async (tx) => {
      const updated = await requestRepository.updateWithVersion(
        id,
        request.version,
        {
          status: Status.CANCELLED,
          completedAt: new Date(),
        },
        tx,
      );

      if (!updated) {
        throw new ConflictError('Version conflict: request was modified by another user. Please reload.');
      }

      await historyRepository.create(
        {
          requestId: id,
          fromStatus: request.status,
          toStatus: Status.CANCELLED,
          changedById: user.id,
          note: 'Request cancelled',
        },
        tx,
      );

      return { message: 'Request cancelled', status: Status.CANCELLED };
    });
  }

  if (request.status === Status.IN_PROGRESS) {
    const updated = await requestRepository.updateWithVersion(
      id,
      request.version,
      {
        cancelRequested: true,
      },
    );

    if (!updated) {
      throw new ConflictError('Version conflict: request was modified by another user. Please reload.');
    }

    return {
      message: 'Cancellation requested for in-progress request',
      status: Status.IN_PROGRESS,
    };
  }

  throw new ConflictError(`Cannot cancel request in ${request.status} status`);
}

export async function retryRequest(
  user: AuthUser,
  id: string,
): Promise<ServiceRequest> {
  const request = await requestRepository.findById(id);
  if (!request) {
    throw new NotFoundError('ServiceRequest');
  }

  if (!canRetryRequest(user, request)) {
    if (user.role !== Role.SUPERVISOR && user.role !== Role.ADMIN) {
      throw new AuthorizationError('Insufficient permissions to retry request');
    }
    throw new ConflictError(`Cannot retry request in status ${request.status}. Only FAILED requests can be retried.`);
  }

  assertTransition(request.status, Status.QUEUED);

  const prisma = getPrismaClient();
  const updated = await prisma.$transaction(async (tx) => {
    const res = await requestRepository.updateWithVersion(
      id,
      request.version,
      {
        status: Status.QUEUED,
        attempts: 0,
        failureReason: null,
      },
      tx,
    );

    if (!res) {
      throw new ConflictError('Version conflict: request was modified by another user. Please reload.');
    }

    await historyRepository.create(
      {
        requestId: id,
        fromStatus: request.status,
        toStatus: Status.QUEUED,
        changedById: user.id,
        note: 'Request retried',
      },
      tx,
    );

    return res;
  });

  return updated;
}

export async function getRequestHistory(
  user: AuthUser,
  id: string,
): Promise<StatusHistory[]> {
  const request = await requestRepository.findById(id);
  if (!request || !canViewRequest(user, request)) {
    throw new NotFoundError('ServiceRequest');
  }

  return historyRepository.findByRequestId(id);
}

export const requestService = {
  createRequest,
  listRequests,
  getRequestById,
  updateRequest,
  cancelRequest,
  retryRequest,
  getRequestHistory,
};

export default requestService;
