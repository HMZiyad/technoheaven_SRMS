# 01. System Analysis: Real-Time Service Request Management System (SRMS)

## 1. Problem Statement
Service organizations often track customer requests manually or via static tracking spreadsheets. This causes:
- Delayed updates and lack of real-time visibility into request progress.
- Bottlenecks during high-volume periods when API servers are blocked by synchronous task execution.
- Race conditions when multiple supervisors attempt to assign or re-prioritize requests simultaneously.
- Operational blind spots where failed tasks go unnoticed and unrecovered.

## 2. Business Objectives
- Provide **instant, non-blocking service request ingestion** for field operators.
- Deliver **live status tracking and progress visualization** to supervisors without manual page refreshes.
- Support **concurrent background processing** that automatically prioritizes urgent requests and scales across multiple worker nodes.
- Maintain an **immutable audit trail** of every status transition and administrative intervention.

## 3. Users and Roles
| Role | Permissions & Responsibilities |
|---|---|
| **Operator** | Submit new service requests (with duplicate protection), view own requests, cancel pending requests, post comments. |
| **Supervisor** | Real-time monitoring dashboard, view all organizational requests, re-assign requests, modify priority, cancel requests, retry failed requests. |
| **Admin** | System administration, user/role management, view infrastructure performance metrics. |

## 4. Key Assumptions
1. Service execution is simulated using a realistic staged pipeline (Validate -> Allocate -> Process -> Finalize) with controlled async duration (5–30 seconds) and configurable failure probability.
2. The initial deployment operates within a single organization without multi-tenant partitioning.
3. System timestamps are normalized in UTC in the persistence layer and formatted locally by client frontends.
4. Requests are never hard-deleted; cancellation and failure are explicit terminal or recoverable states.

## 5. Scope
- **In Scope:** Role-based authentication (JWT + denylist), service request CRUD, state machine enforcement, BullMQ background worker queue, WebSocket bidirectional event gateway, full-text search, pagination, audit history, live dashboard, Docker Compose containerization.
- **Out of Scope:** Billing payment gateway integration, external SMS/email dispatchers, native mobile apps.

## 6. Functional Requirements (FR)
- **FR1 (Creation):** Operators can submit service requests with title, description, category, priority, customer contact, and an idempotency key.
- **FR2 (Tracking):** View paginated, searchable, and filtered lists of requests with detailed individual status views.
- **FR3 (State Transitions):** Enforce strict lifecycle transitions via a central state machine (`SUBMITTED -> QUEUED -> IN_PROGRESS -> COMPLETED/FAILED/CANCELLED`).
- **FR4 (Live Progress):** Real-time percentage progress and stage milestone indicators without browser polling.
- **FR5 (WebSocket Feeds):** Instant server-to-client push notifications isolated by user room and supervisor role.
- **FR6 (Cancellation):** Support immediate queue removal for queued requests and cooperative cancellation for running workers.
- **FR7 (Search & Filtering):** Multi-criteria query engine supporting status, priority, category, date range, and text search.
- **FR8 (Audit Trail):** Automatic recording of every state transition, user attribution, and timestamp.
- **FR9 (Priority Processing):** Priority queueing ensuring urgent tasks preempt normal tasks.
- **FR10 (Failure Recovery):** Automatic retry with exponential backoff, and manual supervisor retry for failed requests.

## 7. Non-Functional Requirements (NFR)
- **Performance:** API p95 response time under 100ms for ingestion and reads.
- **Scalability:** Horizontal scaling of worker containers (`--scale worker=N`) without race conditions.
- **Reliability:** Persistent queueing in Redis and ACID persistence in MariaDB ensures zero lost jobs across container restarts.
- **Security:** Protection against OWASP Top 10, IDOR isolation, rate limiting on auth, and input sanitization via Zod.
- **Maintainability:** Clean separation of concerns (Controllers -> Services -> Repositories) in TypeScript.
