import { User, Role, Prisma } from '@prisma/client';
import { getPrismaClient } from '../db/prisma';

export async function createUser(data: {
  name: string;
  email: string;
  passwordHash: string;
  role?: Role;
}): Promise<User> {
  const prisma = getPrismaClient();
  return prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role ?? Role.OPERATOR,
    },
  });
}

export async function findByEmail(email: string): Promise<User | null> {
  const prisma = getPrismaClient();
  return prisma.user.findUnique({
    where: { email },
  });
}

export async function findById(id: string): Promise<User | null> {
  const prisma = getPrismaClient();
  return prisma.user.findUnique({
    where: { id },
  });
}

export async function updateUser(id: string, data: Partial<User>): Promise<User> {
  const prisma = getPrismaClient();
  const { id: _ignoredId, ...updateData } = data;
  return prisma.user.update({
    where: { id },
    data: updateData as Prisma.UserUpdateInput,
  });
}

export async function listUsers(
  page = 1,
  limit = 20,
): Promise<{ users: User[]; total: number }> {
  const prisma = getPrismaClient();
  const skip = Math.max(0, (page - 1) * limit);
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count(),
  ]);

  return { users, total };
}

export const userRepository = {
  createUser,
  findByEmail,
  findById,
  updateUser,
  listUsers,
};
