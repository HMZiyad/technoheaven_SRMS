import 'dotenv/config';
import { Priority, Category, Status } from '../src/types';
import { requestQueue, queueProducer } from '../src/queue/producer';
import { getPrismaClient, disconnectPrisma } from '../src/db/prisma';
import { disconnectRedis } from '../src/db/redis';

const API_PORT = process.env.PORT || 4000;
const API_BASE_URL = `http://localhost:${API_PORT}/api`;

const OPERATOR_CREDENTIALS = {
  email: 'operator1@srms.local',
  password: 'Password123!',
};

const PRIORITIES: Priority[] = [
  Priority.LOW,
  Priority.MEDIUM,
  Priority.HIGH,
  Priority.URGENT,
];

const CATEGORIES: Category[] = [
  Category.TECHNICAL,
  Category.BILLING,
  Category.GENERAL,
  Category.MAINTENANCE,
  Category.EMERGENCY,
];

/**
 * Authenticates as operator1 and retrieves JWT access token.
 */
async function login(): Promise<string> {
  console.log(`\nLogging in as ${OPERATOR_CREDENTIALS.email}...`);
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(OPERATOR_CREDENTIALS),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Login failed (${response.status}): ${errorText}`);
  }

  const json: any = await response.json();
  const token = json?.data?.token || json?.token;
  if (!token) {
    throw new Error('No authentication token received in login response');
  }

  console.log('Login successful! Bearer token acquired.');
  return token;
}

/**
 * Creates a single request via the REST API and records latency.
 */
async function createRequest(
  token: string,
  index: number,
  priority: Priority,
  category: Category,
): Promise<{ id: string; durationMs: number }> {
  const start = performance.now();
  const payload = {
    title: `Load Test Request #${index + 1} [${priority}]`,
    description: `Performance benchmark service request number ${index + 1} with priority ${priority}`,
    category,
    priority,
    customerName: `Customer ${index + 1}`,
    customerContact: `customer${index + 1}@loadtest.local`,
  };

  const response = await fetch(`${API_BASE_URL}/requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const durationMs = performance.now() - start;

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create request #${index + 1} (${response.status}): ${errorText}`);
  }

  const json: any = await response.json();
  const requestId = json?.data?.id;

  return { id: requestId, durationMs };
}

/**
 * Logs current live queue counts.
 */
async function logLiveQueueStatus(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}> {
  const counts = await requestQueue.getJobCounts(
    'waiting',
    'active',
    'completed',
    'failed',
    'delayed',
    'paused',
  );
  console.log(
    `[Live Queue] Waiting: ${counts.waiting} | Active: ${counts.active} | Completed: ${counts.completed} | Failed: ${counts.failed} | Delayed: ${counts.delayed || 0}`,
  );
  return {
    waiting: counts.waiting,
    active: counts.active,
    completed: counts.completed,
    failed: counts.failed,
  };
}

async function main() {
  console.log('====================================================');
  console.log('       SRMS Queue & Worker Load Testing Suite       ');
  console.log('====================================================');
  console.log(`Target API: ${API_BASE_URL}`);
  console.log(`Total Requests: 30 (cycling LOW, MEDIUM, HIGH, URGENT)`);

  const prisma = getPrismaClient();

  try {
    const token = await login();

    console.log('\nCreating 30 service requests with varying priorities...');
    const responseTimes: number[] = [];
    const createdRequestIds: string[] = [];

    for (let i = 0; i < 30; i++) {
      const priority = PRIORITIES[i % PRIORITIES.length];
      const category = CATEGORIES[i % CATEGORIES.length];

      const { id, durationMs } = await createRequest(token, i, priority, category);
      responseTimes.push(durationMs);
      createdRequestIds.push(id);

      // Transition to QUEUED in DB and enqueue in BullMQ
      await prisma.serviceRequest.update({
        where: { id },
        data: { status: Status.QUEUED },
      });
      await queueProducer.enqueue(id, priority);

      console.log(
        `[${i + 1}/30] Created & Enqueued request ${id} (${priority}) in ${durationMs.toFixed(1)}ms`,
      );
    }

    // Response time statistics calculation
    const totalTime = responseTimes.reduce((a, b) => a + b, 0);
    const avgTime = totalTime / responseTimes.length;
    const minTime = Math.min(...responseTimes);
    const maxTime = Math.max(...responseTimes);
    const sorted = [...responseTimes].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)];

    console.log('\n====================================================');
    console.log('            API Response Time Statistics            ');
    console.log('====================================================');
    console.log(`Total Requests:  ${responseTimes.length}`);
    console.log(`Min Response:    ${minTime.toFixed(2)}ms`);
    console.log(`Max Response:    ${maxTime.toFixed(2)}ms`);
    console.log(`Avg Response:    ${avgTime.toFixed(2)}ms`);
    console.log(`p95 Response:    ${p95.toFixed(2)}ms`);
    console.log('====================================================');

    console.log('\nMonitoring live queue execution for 15 seconds...');
    const monitorInterval = setInterval(async () => {
      await logLiveQueueStatus();
    }, 1500);

    await new Promise((resolve) => setTimeout(resolve, 15000));
    clearInterval(monitorInterval);

    console.log('\nFinal Queue Snapshot:');
    await logLiveQueueStatus();
  } catch (err) {
    console.error('Load test encountered an error:', err);
  } finally {
    console.log('\nCleaning up connections...');
    await queueProducer.close();
    await disconnectPrisma();
    await disconnectRedis();
    console.log('Load test script finished.');
  }
}

main().catch((err) => {
  console.error('Fatal load test error:', err);
  process.exit(1);
});
