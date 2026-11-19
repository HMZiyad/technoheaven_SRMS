import { AuthUser, Role, Status } from '../types';
import { canCancel } from './stateMachine';

export function canViewRequest(
  user: AuthUser,
  request: { createdById: string; assignedToId?: string | null },
): boolean {
  if (user.role === Role.SUPERVISOR || user.role === Role.ADMIN) {
    return true;
  }
  if (user.role === Role.OPERATOR) {
    return request.createdById === user.id;
  }
  return false;
}

export function canCancelRequest(
  user: AuthUser,
  request: { createdById: string; status: Status },
): boolean {
  if (!canCancel(request.status)) {
    return false;
  }
  if (user.role === Role.SUPERVISOR || user.role === Role.ADMIN) {
    return true;
  }
  if (user.role === Role.OPERATOR) {
    return request.createdById === user.id;
  }
  return false;
}

export function canEditRequest(user: AuthUser): boolean {
  return user.role === Role.SUPERVISOR || user.role === Role.ADMIN;
}

export function canRetryRequest(
  user: AuthUser,
  request: { status: Status },
): boolean {
  if (user.role !== Role.SUPERVISOR && user.role !== Role.ADMIN) {
    return false;
  }
  return request.status === Status.FAILED;
}
