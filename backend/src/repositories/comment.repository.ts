import { Comment, Prisma } from '@prisma/client';
import { getPrismaClient } from '../db/prisma';

export type CommentWithAuthor = Comment & {
  author: { id: string; name: string; email: string };
};

export interface CreateCommentData {
  requestId: string;
  authorId: string;
  body: string;
}

export async function create(
  data: CreateCommentData,
  tx?: Prisma.TransactionClient,
): Promise<CommentWithAuthor> {
  const client = tx ?? getPrismaClient();
  return client.comment.create({
    data: {
      requestId: data.requestId,
      authorId: data.authorId,
      body: data.body,
    },
    include: {
      author: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

export async function findByRequestId(
  requestId: string,
  tx?: Prisma.TransactionClient,
): Promise<CommentWithAuthor[]> {
  const client = tx ?? getPrismaClient();
  return client.comment.findMany({
    where: { requestId },
    orderBy: { createdAt: 'asc' },
    include: {
      author: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

export const commentRepository = {
  create,
  findByRequestId,
};

export default commentRepository;
