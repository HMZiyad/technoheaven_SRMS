import { Prisma, StatusHistory } from '@prisma/client';
import { getPrismaClient } from '../db/prisma';
import { Status } from '../types';

if (typeof BigInt !== 'undefined' && !(BigInt.prototype as any).toJSON) {
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };
}

export type StatusHistoryWithUser = StatusHistory & {
  changedBy: { id: string; name: string; email: string } | null;
};

export interface CreateHistoryData {
  requestId: string;
  fromStatus?: Status | null;
  toStatus: Status;
  changedById?: string | null;
  note?: string | null;
}

export async function create(
  data: CreateHistoryData,
  tx?: Prisma.TransactionClient,
): Promise<StatusHistory> {
  const client = tx ?? getPrismaClient();
  return client.statusHistory.create({
    data: {
      requestId: data.requestId,
      fromStatus: data.fromStatus ?? null,
      toStatus: data.toStatus,
      changedById: data.changedById ?? null,
      note: data.note ?? null,
    },
  });
}

export async function findByRequestId(
  requestId: string,
  tx?: Prisma.TransactionClient,
): Promise<StatusHistoryWithUser[]> {
  const client = tx ?? getPrismaClient();
  return client.statusHistory.findMany({
    where: { requestId },
    orderBy: { createdAt: 'asc' },
    include: {
      changedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

export const historyRepository = {
  create,
  findByRequestId,
};

export default historyRepository;
