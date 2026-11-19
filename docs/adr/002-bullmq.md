# ADR 002: BullMQ & Redis for Background Processing

## Status
Accepted

## Context
Service requests undergo long-running processing (simulated 5–30 seconds with multi-stage computation). Executing this work inside the HTTP request loop would block Node.js threads, cause timeouts, and severely limit throughput.

## Decision
We separated request ingestion from execution using **BullMQ on Redis**:
- When an operator submits a request, the API writes a `SUBMITTED` record, enqueues a job into BullMQ, transitions to `QUEUED`, and returns `201 Created` immediately (within milliseconds).
- Background worker processes pull jobs based on configurable concurrency (`WORKER_CONCURRENCY=5`).
- Priority queueing ensures `URGENT` jobs preempt `LOW` priority jobs.
- Automatic exponential backoff retries transient failures.

## Consequences
- High API responsiveness and scalability.
- Work is durable across container restarts.
