import { requestRepository } from '../repositories/request.repository';
import { AuthUser, Role } from '../types';
import { AuthorizationError } from '../utils/errors';

export async function getStats(user?: AuthUser): Promise<{
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byCategory: Record<string, number>;
  topCustomers: { name: string; count: number }[];
  total: number;
  avgProcessingTimeMs: number;
}> {
  return requestRepository.getStats();
}

export const statsService = {
  getStats,
};

export default statsService;
