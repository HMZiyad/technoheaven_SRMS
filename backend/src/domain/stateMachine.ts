import { Status } from '../types';
import { InvalidTransitionError } from '../utils/errors';

type TransitionMap = Partial<Record<Status, Status[]>>;

export const TRANSITION_MAP: TransitionMap = {
  [Status.SUBMITTED]: [Status.QUEUED, Status.CANCELLED],
  [Status.QUEUED]: [Status.IN_PROGRESS, Status.CANCELLED],
  [Status.IN_PROGRESS]: [Status.COMPLETED, Status.FAILED, Status.CANCELLED],
  [Status.FAILED]: [Status.QUEUED],
  [Status.COMPLETED]: [],
  [Status.CANCELLED]: [],
};

export function assertTransition(from: Status, to: Status): void {
  const allowed = TRANSITION_MAP[from] ?? [];
  if (!allowed.includes(to)) {
    throw new InvalidTransitionError(from, to);
  }
}

export function isTerminal(status: Status): boolean {
  return status === Status.COMPLETED || status === Status.CANCELLED;
}

export function canCancel(status: Status): boolean {
  return ([Status.SUBMITTED, Status.QUEUED, Status.IN_PROGRESS] as Status[]).includes(status);
}
