import { canViewRequest } from '../domain/policy';
import { commentRepository, CommentWithAuthor } from '../repositories/comment.repository';
import { requestRepository } from '../repositories/request.repository';
import { AuthUser } from '../types';
import { NotFoundError } from '../utils/errors';
import { eventPublisher } from '../realtime/eventPublisher';

export async function addComment(
  user: AuthUser,
  requestId: string,
  body: string,
): Promise<CommentWithAuthor> {
  const request = await requestRepository.findById(requestId);
  if (!request || !canViewRequest(user, request)) {
    throw new NotFoundError('ServiceRequest');
  }

  const comment = await commentRepository.create({
    requestId,
    authorId: user.id,
    body,
  });

  await eventPublisher.publishCommentAdded({
    requestId,
    comment,
    createdById: request.createdById,
  });

  return comment;
}

export async function getComments(
  user: AuthUser,
  requestId: string,
): Promise<CommentWithAuthor[]> {
  const request = await requestRepository.findById(requestId);
  if (!request || !canViewRequest(user, request)) {
    throw new NotFoundError('ServiceRequest');
  }

  return commentRepository.findByRequestId(requestId);
}

export const commentService = {
  addComment,
  getComments,
};

export default commentService;
