# ADR 006: Cooperative Cancellation for Long-Running Background Tasks

## Status
Accepted

## Context
When an operator or supervisor cancels a service request that is actively being processed by a worker (`IN_PROGRESS`), killing worker threads or processes risks leaving database records and external resources in inconsistent, corrupt states.

## Decision
We implemented **cooperative cancellation**:
- When cancellation is requested for an `IN_PROGRESS` job, the API sets `cancel_requested = true` in MariaDB and returns `202 Accepted`.
- The worker executes work across defined stages (`Validate` -> `Allocate` -> `Process` -> `Finalize`).
- Between each stage, the worker queries `cancel_requested`.
- If flagged, the worker halts gracefully, rolls back or cleans up allocated resources, transitions status to `CANCELLED`, records the audit history, and emits a cancellation event.

## Consequences
- Clean cleanup and consistent state.
- Workers never terminate abruptly mid-transaction.
