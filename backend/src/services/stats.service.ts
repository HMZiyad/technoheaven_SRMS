import { requestRepository } from '../repositories/request.repository';
import { AuthUser, Role } from '../types';
import { AuthorizationError } from '../utils/errors';

export async function getStats(user: AuthUser): Promise<{
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  total: number;
  avgProcessingTimeMs: number;
}> {
  if (user.role !== Role.SUPERVISOR && user.role !== Role.ADMIN) {
    throw new AuthorizationError('Only supervisors and administrators can access system statistics');
  }

  return requestRepository.getStats();
}

export const statsService = {
  getStats,
};

export default statsService;
