# ADR 004: Optimistic Concurrency Control with Version Column

## Status
Accepted

## Context
Multiple supervisors might view and edit the same request simultaneously (e.g. changing priority or assignee), leading to silent overwrites and lost updates.

## Decision
We implemented optimistic concurrency control:
- Each `service_requests` row includes an integer `version` column starting at 1.
- All status changes and metadata updates include `WHERE id = ? AND version = ?`, atomically incrementing `version = version + 1`.
- If zero rows are affected, a `ConflictError` (`409 Conflict`) is raised, prompting the client to reload the latest state.

## Consequences
- Prevents race conditions without heavy distributed locking.
- Clients are explicitly notified of concurrent changes.
