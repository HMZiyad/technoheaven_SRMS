import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const defaultPassword = await argon2.hash('Password123!');

  await prisma.user.upsert({
    where: { email: 'admin@srms.local' },
    update: {},
    create: {
      name: 'System Admin',
      email: 'admin@srms.local',
      passwordHash: defaultPassword,
      role: 'ADMIN',
    },
  });

  const supervisor1 = await prisma.user.upsert({
    where: { email: 'supervisor@srms.local' },
    update: {},
    create: {
      name: 'Sarah Supervisor',
      email: 'supervisor@srms.local',
      passwordHash: defaultPassword,
      role: 'SUPERVISOR',
    },
  });

  const operator1 = await prisma.user.upsert({
    where: { email: 'operator1@srms.local' },
    update: {},
    create: {
      name: 'Omar Operator',
      email: 'operator1@srms.local',
      passwordHash: defaultPassword,
      role: 'OPERATOR',
    },
  });

  const operator2 = await prisma.user.upsert({
    where: { email: 'operator2@srms.local' },
    update: {},
    create: {
      name: 'Alice Operator',
      email: 'operator2@srms.local',
      passwordHash: defaultPassword,
      role: 'OPERATOR',
    },
  });

  const counter = await prisma.requestCounter.findFirst();
  if (!counter) {
    await prisma.requestCounter.create({ data: { value: 0 } });
  }

  console.log('Seeded users:');
  console.log('  admin@srms.local       / Password123! (ADMIN)');
  console.log('  supervisor@srms.local  / Password123! (SUPERVISOR)');
  console.log('  operator1@srms.local   / Password123! (OPERATOR)');
  console.log('  operator2@srms.local   / Password123! (OPERATOR)');

  const count = await prisma.serviceRequest.count();
  if (count === 0) {
    await prisma.serviceRequest.create({
      data: {
        reference: 'SR-000001',
        title: 'Network connectivity issue in building A',
        description: 'Users in building A cannot connect to the internal network since 9am.',
        category: 'TECHNICAL',
        priority: 'HIGH',
        status: 'SUBMITTED',
        customerName: 'Building A Team',
        customerContact: 'buildingA@company.com',
        createdById: operator1.id,
        history: {
          create: [{ toStatus: 'SUBMITTED', changedById: operator1.id, note: 'Request created' }],
        },
      },
    });

    await prisma.serviceRequest.create({
      data: {
        reference: 'SR-000002',
        title: 'Billing discrepancy for account #4421',
        description: 'Customer reports overcharge of $200 on last month bill.',
        category: 'BILLING',
        priority: 'MEDIUM',
        status: 'COMPLETED',
        progress: 100,
        customerName: 'John Smith',
        customerContact: 'john.smith@email.com',
        createdById: operator2.id,
        completedAt: new Date(),
        history: {
          create: [
            { toStatus: 'SUBMITTED', changedById: operator2.id, note: 'Request created' },
            { fromStatus: 'SUBMITTED', toStatus: 'QUEUED', note: 'Enqueued' },
            { fromStatus: 'QUEUED', toStatus: 'IN_PROGRESS', note: 'Processing started' },
            { fromStatus: 'IN_PROGRESS', toStatus: 'COMPLETED', changedById: supervisor1.id, note: 'Resolved' },
          ],
        },
      },
    });

    await prisma.serviceRequest.create({
      data: {
        reference: 'SR-000003',
        title: 'Emergency HVAC failure in server room',
        description: 'Server room temperature rising. AC unit has stopped working.',
        category: 'EMERGENCY',
        priority: 'URGENT',
        status: 'IN_PROGRESS',
        progress: 45,
        currentStage: 'Process',
        customerName: 'IT Infrastructure',
        customerContact: 'infra@company.com',
        createdById: operator1.id,
        assignedToId: supervisor1.id,
        startedAt: new Date(),
        history: {
          create: [
            { toStatus: 'SUBMITTED', changedById: operator1.id, note: 'Request created' },
            { fromStatus: 'SUBMITTED', toStatus: 'QUEUED', note: 'Enqueued' },
            { fromStatus: 'QUEUED', toStatus: 'IN_PROGRESS', note: 'Processing started' },
          ],
        },
      },
    });

    await prisma.requestCounter.updateMany({ data: { value: 3 } });
    console.log('Created 3 sample service requests');
  }

  console.log('Seed complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
