# Task List: From Zero to Submission

Build order: **docs, then Docker foundation, then backend (all of it), then frontend, then polish and submit.** Everything runs inside Docker, so you do not need Node, MariaDB, or Redis installed on your machine. Only Docker, Docker Compose, and Git.

**How to use this file**

- Work top to bottom. Do not start a phase until the previous phase's **Done when** is true.
- Tick boxes as you go (`- [x]`).
- Each phase ends with suggested **commits**, so your Git history stays meaningful.
- Tasks marked **(extra)** are beyond the PDF. Tasks marked **(bonus)** are the PDF's optional items. If time runs short, cut these first.

**Reference files:** `PLANNING.md` (what and why), `ARCHITECTURE.md` (how it fits together), `SECURITY_ARCHITECTURE.md` (how it is protected).

---

## Progress overview

| Phase | Name | Est. time |
|---|---|---|
| 0 | Prerequisites and repository | 1 hour |
| 1 | Analysis and design documents | 4 to 6 hours |
| 2 | Docker foundation (dev environment) | 3 to 4 hours |
| 3 | Backend foundation (skeleton, config, DB, errors) | 4 to 6 hours |
| 4 | Backend: authentication and users | 4 to 6 hours |
| 5 | Backend: service request REST API | 6 to 8 hours |
| 6 | Backend: queue and concurrent workers | 6 to 8 hours |
| 7 | Backend: real-time WebSockets | 5 to 7 hours |
| 8 | Backend: hardening, extras, and tests | 6 to 8 hours |
| 9 | Frontend foundation | 3 to 4 hours |
| 10 | Frontend: auth and layout | 3 to 4 hours |
| 11 | Frontend: operator features | 4 to 6 hours |
| 12 | Frontend: supervisor dashboard and live updates | 6 to 8 hours |
| 13 | Frontend: detail page, comments, polish | 4 to 6 hours |
| 14 | Production Docker, CI/CD, and deployment | 4 to 6 hours |
| 15 | Final documentation and submission | 4 to 6 hours |

Total: roughly 65 to 90 hours. Adjust scope using the "cut first" list at the end.

---

# PART A: Foundation

## Phase 0: Prerequisites and repository

- [ ] Install Docker Desktop (or Docker Engine + Compose plugin) and verify: `docker --version`, `docker compose version`
- [ ] Install Git and set name/email: `git config --global user.name ...`
- [ ] Choose an editor (VS Code) with extensions: Docker, ESLint, Prettier, Prisma, Mermaid preview
- [ ] Create a GitHub repository `service-request-system` (public or private as required)
- [ ] Clone it and create the top-level structure:
  - [ ] `backend/`
  - [ ] `frontend/`
  - [ ] `docs/` and `docs/adr/`
  - [ ] `.github/workflows/`
- [ ] Add `.gitignore` (node_modules, `.env`, dist, coverage, volumes)
- [ ] Add `.editorconfig` and a starter `README.md` (title and one-paragraph description only)
- [ ] Copy `PLANNING.md`, `ARCHITECTURE.md`, `SECURITY_ARCHITECTURE.md` and `TASKS.md` into `docs/`
- [ ] Decide branching: `main` (stable) plus short feature branches (`feat/...`)

**Done when:** the repo exists on GitHub with the folder structure and a first commit.

**Commits**
- `chore: initialize repository structure`
- `docs: add planning, architecture and security documents`

---

## Phase 1: Analysis and design documents

The PDF asks for these deliverables, and they should exist **before** feature code.

### 1A. System analysis (`docs/01-system-analysis.md`)

- [ ] Problem statement
- [ ] Business objectives
- [ ] Users and roles (operator, supervisor, admin)
- [ ] Assumptions (simulated processing, single organization, etc.)
- [ ] Scope: in scope / out of scope
- [ ] Functional requirements, numbered (FR1 to FR18 from `PLANNING.md`)
- [ ] Non-functional requirements with justification (performance, scalability, reliability, security, maintainability, availability, usability, responsiveness)
- [ ] Use cases or user stories for each role (short list is enough)

### 1B. System design (`docs/02-system-design.md`)

- [ ] High-level architecture diagram
- [ ] Component diagram
- [ ] Database design: ERD and table descriptions
- [ ] API design: endpoint table with request/response examples
- [ ] WebSocket communication flow and event catalog
- [ ] Concurrency model
- [ ] Technology stack justification
- [ ] State machine diagram for request status
- [ ] Security summary (link to `SECURITY_ARCHITECTURE.md`)

### 1C. Decision records

- [ ] Write 5 to 8 short ADRs in `docs/adr/` (stack, queue choice, Socket.IO, optimistic locking, JWT strategy, cooperative cancel)

**Done when:** both documents are committed and diagrams render on GitHub.

**Commits**
- `docs: add system analysis`
- `docs: add system design with diagrams and ERD`
- `docs: add architecture decision records`

---

## Phase 2: Docker foundation (development environment)

Goal: one command starts MariaDB, Redis, and a backend container with live reload. The frontend is added in Phase 9.

### 2A. Compose file for infrastructure

- [ ] Create root `docker-compose.yml` with services:
  - [ ] `db` (MariaDB 11): env vars, named volume, healthcheck (`healthcheck.sh --connect`), **no published port** (or bind to `127.0.0.1` only if you want a DB client)
  - [ ] `redis` (Redis 7): `--appendonly yes`, password, named volume, healthcheck
- [ ] Create `.env.example` at root with placeholders:
  - [ ] `MARIADB_ROOT_PASSWORD`, `MARIADB_DATABASE`, `MARIADB_USER`, `MARIADB_PASSWORD`
  - [ ] `REDIS_PASSWORD`
  - [ ] `JWT_SECRET` (placeholder)
- [ ] Copy to `.env` (git-ignored) with real local values
- [ ] Run `docker compose up -d db redis` and confirm both are `healthy`
- [ ] Test connections from inside containers (`docker compose exec db mariadb -u... -p`, `docker compose exec redis redis-cli -a ... ping`)

### 2B. Backend development container

- [ ] Create `backend/Dockerfile` with **multi-stage** targets:
  - [ ] `base` (node:20-alpine, working dir, install deps)
  - [ ] `dev` (runs with hot reload, e.g. `tsx watch`)
  - [ ] `build` (compiles TypeScript)
  - [ ] `prod` (production deps only, non-root user, runs compiled JS)
- [ ] Create `backend/.dockerignore` (node_modules, dist, .env, .git)
- [ ] Add `api` service to Compose using `target: dev`:
  - [ ] Bind-mount `./backend/src` for live reload, with an anonymous volume for `node_modules`
  - [ ] `depends_on` db and redis with `condition: service_healthy`
  - [ ] Environment from `.env`
  - [ ] Published port `4000:4000`
- [ ] Add `worker` service (same image, different command) using `target: dev`
- [ ] Add a one-shot `migrate` service or document the exec command for migrations
- [ ] Write a `Makefile` (or `scripts/`) with shortcuts:
  - [ ] `make up`, `make down`, `make logs`, `make api-sh`, `make migrate`, `make seed`, `make test`

**Docker tips for this project**

- Run every tool inside containers: `docker compose exec api npm install <pkg>`, `docker compose run --rm api npx prisma migrate dev`.
- After `npm install` inside the container, the lockfile updates on your host through the bind mount. Commit it.
- Use `docker compose down -v` only when you want to wipe the database.

**Done when:** `docker compose up` starts db, redis, api, and worker; code changes in `backend/src` reload automatically.

**Commits**
- `build: add docker compose with mariadb and redis`
- `build(backend): add multi-stage dockerfile and dev service`
- `chore: add makefile and env example`

---

# PART B: Backend

## Phase 3: Backend foundation

### 3A. Project setup

- [ ] Initialize `backend/package.json` (inside the container)
- [ ] Install runtime packages: `express`, `zod`, `pino`, `pino-http`, `helmet`, `cors`, `dotenv` (or rely on Compose env), `uuid`
- [ ] Install dev packages: `typescript`, `tsx`, `@types/node`, `@types/express`, `eslint`, `prettier`, `vitest` (or jest), `supertest`
- [ ] Configure `tsconfig.json` (strict mode on)
- [ ] Configure ESLint and Prettier; add npm scripts: `dev`, `build`, `start`, `lint`, `test`
- [ ] Create folder structure from `ARCHITECTURE.md`:
  - [ ] `src/config`, `controllers`, `services`, `repositories`, `middleware`, `validators`, `queue`, `realtime`, `utils`, `types`
  - [ ] Entry points: `src/server.ts` and `src/worker.ts`

### 3B. Configuration and app skeleton

- [ ] Typed config module that validates env vars with Zod and fails fast
- [ ] Express app factory (`createApp()`) separated from the server start (makes testing easy)
- [ ] Middleware: request ID, JSON body limit, helmet, CORS (from config), pino HTTP logger
- [ ] `GET /api/v1/health/live` and `GET /api/v1/health/ready` (checks DB and Redis)
- [ ] Central error-handling middleware and typed error classes (`ValidationError`, `NotFoundError`, `ForbiddenError`, `ConflictError`, ...)
- [ ] Standard error response shape: `{ error: { code, message, details, requestId } }`
- [ ] Graceful shutdown handler (SIGTERM closes server, DB, Redis)

### 3C. Database setup (Prisma + MariaDB)

- [ ] Install Prisma; initialize with the MySQL/MariaDB provider
- [ ] Write the schema for: `User`, `ServiceRequest`, `StatusHistory`, `Comment`, `DomainEvent`
  - [ ] Enums: `Role`, `Category`, `Priority`, `Status`
  - [ ] Foreign keys, unique constraints, indexes (see `ARCHITECTURE.md` section 5)
  - [ ] `version` column for optimistic locking, `cancelRequested`, `idempotencyKey`
- [ ] Create the first migration: `prisma migrate dev --name init`
- [ ] Add FULLTEXT index on title and description (raw SQL in the migration)
- [ ] Create a Prisma client singleton
- [ ] Write the seed script: 1 admin, 1 supervisor, 2 operators (passwords from env or documented dev defaults)
- [ ] Confirm the tables exist and the seed runs inside Docker

**Done when:** `GET /api/v1/health/ready` returns OK with DB and Redis connected, migrations apply from scratch, and seed data loads.

**Commits**
- `chore(backend): initialize typescript project with linting`
- `feat(backend): add validated configuration module`
- `feat(backend): add express app skeleton with error handling and health checks`
- `feat(db): add prisma schema and initial migration`
- `feat(db): add seed script`

---

## Phase 4: Authentication and users

### 4A. Passwords and tokens

- [ ] Install `argon2` (or `bcrypt`) and `jsonwebtoken` (or `jose`)
- [ ] Password hashing utility with `hash()` and `verify()`
- [ ] Token utility: sign and verify access token (explicit algorithm, claims: `sub`, `role`, `jti`)
- [ ] Password policy validator (min 10 chars, max 128)

### 4B. Endpoints

- [ ] `POST /auth/register` (operator role only, or admin-only; decide and document)
- [ ] `POST /auth/login` with generic error messages and dummy-hash timing protection
- [ ] `GET /auth/me`
- [ ] `POST /auth/logout` (denylist the token `jti` in Redis until expiry)
- [ ] **(extra)** `POST /auth/refresh` with rotating refresh tokens in an `HttpOnly` cookie (stored hashed in DB)
- [ ] Zod schemas for each request body (strict)

### 4C. Middleware

- [ ] `authenticate` middleware: verify token, check denylist, load user (cache briefly), reject inactive users
- [ ] `requireRole(...roles)` middleware
- [ ] Attach `req.user` with proper TypeScript typing

### 4D. Protection

- [ ] Redis-based rate limiter middleware (configurable per route)
- [ ] Apply to login (strict) and register
- [ ] **(extra)** temporary lockout after repeated failed logins

### 4E. Tests

- [ ] Unit tests: password hash/verify, token sign/verify, expired and tampered tokens
- [ ] Integration tests: register, login success and failure, `me`, logout then denylisted token rejected, role middleware, rate limit returns `429`

**Done when:** you can log in as each seeded user via a REST client (Postman, Insomnia, or curl) and protected routes reject missing, invalid, or wrong-role tokens.

**Commits**
- `feat(auth): add password hashing and jwt utilities`
- `feat(auth): add register, login, me and logout endpoints`
- `feat(auth): add authenticate and role middleware`
- `feat(security): add redis rate limiting for auth endpoints`
- `test(auth): cover login, token and role scenarios`

---

## Phase 5: Service request REST API

### 5A. Domain core

- [ ] Status enum and the **transition map** (single source of truth) in a pure module
- [ ] Function `assertTransition(from, to)` throwing `InvalidTransitionError`
- [ ] Policy module: `canViewRequest`, `canCancelRequest`, `canEditRequest`, etc.
- [ ] Unit tests for every allowed and forbidden transition and every policy rule
- [ ] Reference number generator (`SR-000123`)

### 5B. Repositories

- [ ] `RequestRepository`: create, findById, list (with filters), update with version check, count open requests by user
- [ ] `HistoryRepository`: append, list by request
- [ ] `CommentRepository`: create, list by request
- [ ] `UserRepository`: finders used by auth and assignment

### 5C. Services (business logic)

- [ ] `RequestService.create`: validate, check open-request limit, handle idempotency key, insert request and first history row in one transaction
- [ ] `RequestService.list`: scope by role (operators see only theirs), apply filters, search, sorting, pagination
- [ ] `RequestService.getById`: policy check, return `404` if not visible
- [ ] `RequestService.update` (priority, assignee, details) with `version` check, returning `409` on conflict
- [ ] `RequestService.transition`: the single method used for all status changes (transaction: update with version check + history row)
- [ ] `RequestService.cancel` for `SUBMITTED`/`QUEUED` (direct) and `IN_PROGRESS` (sets `cancelRequested`, returns `202`)
- [ ] `RequestService.retry` for `FAILED`
- [ ] `CommentService.add` and list

### 5D. Validation schemas

- [ ] Create request schema (lengths, enums, contact format, strict)
- [ ] List query schema (`page`, `limit` max 100, filters, `sort` whitelist, `q`)
- [ ] Update schema (requires `version`)
- [ ] Comment schema

### 5E. Controllers and routes

- [ ] `POST /requests` (supports `Idempotency-Key` header)
- [ ] `GET /requests`, `GET /requests/:id`
- [ ] `PATCH /requests/:id`
- [ ] `POST /requests/:id/cancel`, `POST /requests/:id/retry`
- [ ] `GET /requests/:id/history`
- [ ] `POST /requests/:id/comments` and `GET` comments
- [ ] `GET /stats` (counts by status, average processing time)
- [ ] Wire middleware order: rate limit, authenticate, role, validate, controller

### 5F. API documentation

- [ ] Generate OpenAPI from Zod schemas (e.g., `zod-to-openapi`) and serve Swagger UI at `/api/docs`, **or** maintain an API table in the README by hand

### 5G. Tests

- [ ] Integration tests: create, validation errors, list with each filter, pagination, search, forbidden access (IDOR test: operator A cannot see operator B's request), invalid transition returns `409`, version conflict returns `409`, idempotent create returns the same request
- [ ] **Authorization matrix test** (role x endpoint)

**Done when:** every REST endpoint works against the real database in Docker, and tests pass. Requests are created in status `QUEUED` but nothing processes them yet.

**Commits**
- `feat(domain): add request state machine and policies`
- `feat(requests): add repositories and request service`
- `feat(api): add create and list request endpoints with validation`
- `feat(api): add update, cancel and retry endpoints`
- `feat(api): add history, comments and stats endpoints`
- `docs(api): add openapi documentation`
- `test(requests): add integration and authorization tests`

---

## Phase 6: Queue and concurrent workers

### 6A. Queue setup

- [ ] Install `bullmq` and `ioredis`
- [ ] Queue configuration module (connection, default job options: attempts, exponential backoff, `removeOnComplete`)
- [ ] `QueueProducer.enqueue(requestId, priority)` using `jobId = requestId`
- [ ] Priority mapping (URGENT = 1 to LOW = 4)
- [ ] Update `RequestService.create`: after the commit, enqueue the job, then transition `SUBMITTED` to `QUEUED`
- [ ] `RequestService.cancel` for queued requests removes the job from the queue

### 6B. Worker process

- [ ] `src/worker.ts` entry creating a BullMQ `Worker` with `concurrency` from config
- [ ] `JobHandler`: load request, **guard** (only proceed if status is `QUEUED` and not cancelled), compare-and-set transition to `IN_PROGRESS`
- [ ] Stage pipeline with 4 stages (Validate, Allocate, Process, Finalize) using simulated async delays
- [ ] After each stage: persist progress and stage name, check `cancelRequested`
- [ ] Configurable failure probability to simulate errors
- [ ] On success: transition to `COMPLETED`, set `completedAt`
- [ ] On final failure (attempts exhausted): transition to `FAILED` with `failureReason`
- [ ] On cancel flag: transition to `CANCELLED` and stop
- [ ] Handle worker events (`completed`, `failed`, `stalled`) with logging
- [ ] Graceful shutdown: stop taking jobs, wait for in-flight work with a timeout

### 6C. Recovery

- [ ] Reconciler job (repeatable, every minute):
  - [ ] Requests stuck `IN_PROGRESS` with no active job beyond a timeout become re-queued or `FAILED (worker_lost)`
  - [ ] `SUBMITTED` requests older than a threshold get enqueued
- [ ] Retry endpoint creates a fresh job and resets attempts

### 6D. Concurrency verification

- [ ] Script `scripts/load-test.ts`: create 50 requests quickly using several users
- [ ] Verify (manually and in a test) that:
  - [ ] API responses stay fast while jobs run (create returns in milliseconds)
  - [ ] Multiple requests are `IN_PROGRESS` at the same time (up to the concurrency limit)
  - [ ] All requests reach a final state
  - [ ] No request is processed twice
  - [ ] Urgent requests start before low-priority ones
- [ ] Scale demo: `docker compose up --scale worker=3` and observe the throughput change

### 6E. Tests

- [ ] Integration test with real Redis: job completes and updates DB
- [ ] Failure and retry path test
- [ ] Cancel mid-processing test
- [ ] Double-processing prevention test (simulate two workers taking the same request)

**Done when:** creating a request through the API leads to it being processed in the background through all stages, in parallel with others, and the final status is stored in the DB. The API stays responsive throughout.

**Commits**
- `feat(queue): add bullmq producer and queue configuration`
- `feat(worker): add worker process with staged job pipeline`
- `feat(worker): add cooperative cancellation and failure handling`
- `feat(worker): add reconciler for stuck and orphaned requests`
- `test(concurrency): add load script and concurrent processing tests`

---

## Phase 7: Real-time WebSockets

### 7A. Event infrastructure

- [ ] Define the event envelope type and the event catalog (shared types)
- [ ] `EventPublisher`: save to `domain_events` (after DB commit), publish to Redis channel
- [ ] Call the publisher from `RequestService` (created, status changed, updated, comment added) and from the worker (status changes, progress)
- [ ] Progress throttle: at most 1 event per request per second
- [ ] Event retention cleanup job (delete events older than the configured hours)

### 7B. Socket gateway

- [ ] Install `socket.io`, `@socket.io/redis-adapter`
- [ ] Attach Socket.IO to the HTTP server in `server.ts`
- [ ] Connection middleware: Origin check, JWT verification, denylist check, attach user
- [ ] On connect: join `user:<id>` and `role:supervisor` (if applicable)
- [ ] `request:subscribe` / `request:unsubscribe` handlers with policy check and Zod validation
- [ ] Per-socket event rate limit and max rooms; max sockets per user
- [ ] Redis subscriber that routes events to rooms per audience rules
- [ ] Disconnect user's sockets on logout, deactivation, or role change
- [ ] Handle token expiry (disconnect, client reconnects with a new token)

### 7C. Reconnect sync

- [ ] `GET /events?since=<eventId>` (role-filtered; returns `gapTooLarge` when the window is exceeded)
- [ ] Include `eventId` in every pushed event

### 7D. Stats events

- [ ] Debounced `stats:updated` broadcast to supervisors (every 1 to 2 seconds when something changed)

### 7E. Tests and manual verification

- [ ] Test with a socket client: connect without token fails; wrong origin fails
- [ ] Operator receives only own events; supervisor receives all
- [ ] Unauthorized `request:subscribe` is denied
- [ ] Status change from the worker reaches a connected client without polling
- [ ] Event flood gets the socket disconnected
- [ ] Manual check with a simple HTML page or `wscat`/socket.io client script in `scripts/`

**Done when:** a connected client receives `request:created`, progress, and status events live while workers process, with correct audience filtering.

**Commits**
- `feat(realtime): add event publisher and redis event bus`
- `feat(realtime): add authenticated socket gateway with rooms`
- `feat(realtime): route worker and api events to client rooms`
- `feat(realtime): add reconnect sync endpoint and stats events`
- `test(realtime): cover socket auth, routing and flood protection`

---

## Phase 8: Backend hardening, extras, and tests

### 8A. Security pass (use the checklist in `SECURITY_ARCHITECTURE.md` section 20)

- [ ] Strict Zod on every route; no unknown fields accepted
- [ ] Mass-assignment test (`role`, `status`, `createdBy` in body are rejected)
- [ ] Error handler never leaks internals
- [ ] Log redaction for `authorization`, `cookie`, passwords
- [ ] Rate limits on create, list, and search endpoints
- [ ] `trust proxy` configured for running behind Nginx
- [ ] Least-privilege DB user for the app (separate migration user)
- [ ] Secret scan (gitleaks) run locally once

### 8B. Observability

- [ ] Structured logs with `requestId`, `userId`, `jobId` fields
- [ ] Security event logging (login, denials, refresh reuse)
- [ ] `/metrics` endpoint (Prometheus format) **(bonus)**
- [ ] Mount Bull Board for admin **(extra)**

### 8C. Test coverage

- [ ] Unit tests for services and domain logic
- [ ] Integration tests for all endpoints
- [ ] Add coverage report; aim for 70%+ on services and domain code
- [ ] `docker compose run --rm api npm test` works from a clean state (test database created automatically)

### 8D. Cleanup

- [ ] Remove dead code and TODOs, run lint and format
- [ ] Review commit history and clean up if needed
- [ ] Tag the backend milestone: `git tag backend-complete`

**Done when:** all backend tests pass in Docker, lint is clean, and the backend can be demonstrated entirely through API calls and a socket client.

**Commits**
- `feat(security): add log redaction, request limits and trust proxy`
- `feat(observability): add structured logging and metrics`
- `test: raise coverage for services and domain`
- `chore: lint, format and tag backend milestone`

---

# PART C: Frontend

## Phase 9: Frontend foundation

- [ ] Create `frontend/` with Vite + React + TypeScript (run inside a container: `docker compose run --rm frontend npm create vite@latest ...` or a temporary `node:20-alpine` container)
- [ ] `frontend/Dockerfile` with targets:
  - [ ] `dev` (Vite dev server, host `0.0.0.0`, HMR working through Docker; set `server.watch.usePolling` if file changes are not detected)
  - [ ] `build` (compiles static files)
  - [ ] `prod` (Nginx serving the build)
- [ ] Add `frontend` service to `docker-compose.yml` (port `5173`, bind mount `src`, env `VITE_API_URL`)
- [ ] Configure CORS on the backend for `http://localhost:5173`
- [ ] Install: `react-router-dom`, `@tanstack/react-query`, `zustand`, `socket.io-client`, `zod`, `react-hook-form` + `@hookform/resolvers`, Tailwind CSS
- [ ] Set up Tailwind, ESLint, Prettier
- [ ] Folder structure: `src/api`, `components`, `pages`, `hooks`, `store`, `types`, `utils`
- [ ] Share types: copy or generate request/response types from backend schemas (a small shared `types` folder or a script)
- [ ] Typed API client (fetch wrapper): base URL, auth header, JSON handling, error normalization to the `{error: {...}}` shape

**Done when:** `docker compose up` serves the React app at `http://localhost:5173` and it can call `GET /health/live` on the API.

**Commits**
- `chore(frontend): scaffold vite react typescript app`
- `build(frontend): add dockerfile and compose service`
- `feat(frontend): add api client, router, query and tailwind setup`

---

## Phase 10: Auth and layout

- [ ] Auth store (Zustand): `user`, `accessToken` (memory only), `status`
- [ ] Login page: form with validation (Zod), loading and error states, calls `/auth/login`
- [ ] Token refresh logic: on `401`, try `/auth/refresh` once, else log out **(extra, if implemented in backend)**
- [ ] Restore session on page load (call refresh or `me`)
- [ ] Route guards: `ProtectedRoute` and `RoleRoute`
- [ ] App layout: header with user name, role badge, logout button, navigation by role
- [ ] Responsive navigation (collapsible on mobile)
- [ ] Global toast system and error boundary
- [ ] 404 and "not authorized" pages

**Done when:** you can log in as an operator or supervisor, see a role-appropriate layout, refresh the page without being logged out (if refresh is implemented), and log out.

**Commits**
- `feat(frontend): add auth store and login page`
- `feat(frontend): add route guards and responsive layout`
- `feat(frontend): add toast notifications and error boundary`

---

## Phase 11: Operator features

- [ ] **Create request form**
  - [ ] Fields: title, description, category, priority, customer name, customer contact
  - [ ] Inline validation with the same rules as the backend
  - [ ] Generate and send an `Idempotency-Key` per submission; disable the button while submitting
  - [ ] Success toast and redirect or list refresh
  - [ ] Show server validation errors per field
- [ ] **My requests list**
  - [ ] Table on desktop, cards on mobile
  - [ ] Status and priority badges, progress bar
  - [ ] Pagination
  - [ ] Filters (status, priority, category, date range) and search box
  - [ ] Loading skeletons, empty state, error state with retry
- [ ] Cancel action with confirmation dialog (own requests only)
- [ ] Query hooks with TanStack Query (`useRequests`, `useCreateRequest`, `useCancelRequest`)

**Done when:** an operator can create, browse, filter, search, and cancel their own requests, on desktop and mobile widths.

**Commits**
- `feat(frontend): add create request form with validation`
- `feat(frontend): add requests list with filters, search and pagination`
- `feat(frontend): add cancel action with confirmation`

---

## Phase 12: Supervisor dashboard and live updates

### 12A. Socket integration

- [ ] `useSocket` hook: connect with the token in the `auth` field, handle `connect`, `disconnect`, `connect_error`, reconnect
- [ ] Connection status indicator ("Live", "Reconnecting...", "Offline")
- [ ] Requests store (Zustand) keyed by ID: actions `upsert`, `patch`, `remove`
- [ ] Event handlers update the store directly:
  - [ ] `request:created`: add to list
  - [ ] `request:status_changed`: update status
  - [ ] `request:progress`: update progress and stage
  - [ ] `request:updated`, `request:comment_added`
  - [ ] `stats:updated`: update dashboard counters
- [ ] Ignore stale events using `eventId` and `version`
- [ ] Reconnect recovery: remember the last `eventId`, call `/events?since=`, apply missed events or refetch fully

### 12B. Dashboard page

- [ ] Stats cards (totals by status, average processing time, throughput) updating live
- [ ] Live requests table for all requests with the same filters, search, sorting, pagination
- [ ] Rows update in place (brief highlight animation on change)
- [ ] Progress bars animate as progress events arrive
- [ ] Priority sorting and a quick "urgent only" filter
- [ ] Supervisor actions from the table: assign, change priority, cancel, retry (failed ones)
- [ ] Handle `409` conflicts with a "reload latest" message

### 12C. Verify real-time end to end

- [ ] Two browser windows (operator and supervisor)
- [ ] Operator creates a request: supervisor sees it appear instantly (no refresh)
- [ ] Progress moves in real time as the worker runs
- [ ] Cancel and retry reflected instantly on both sides
- [ ] Stop and restart the API container: UI shows "Reconnecting", then recovers and catches up
- [ ] Confirm in the browser network tab: no repeating polling requests

**Done when:** the supervisor dashboard updates live for many simultaneous requests without refresh, and reconnect recovery works.

**Commits**
- `feat(frontend): add socket hook and live requests store`
- `feat(frontend): add supervisor dashboard with live stats and table`
- `feat(frontend): add supervisor actions and conflict handling`
- `feat(frontend): add reconnect sync and connection indicator`

---

## Phase 13: Detail page, comments, and polish

- [ ] **Request detail page**
  - [ ] Header with reference number, status badge, priority, customer info
  - [ ] Large progress bar with current stage and stage timeline
  - [ ] Status history timeline (who, when, from, to)
  - [ ] Join the `request:<id>` room on open and leave on close
  - [ ] Actions by role: cancel, retry, edit priority, assign
  - [ ] Edit form that sends `version` and handles conflicts
- [ ] **Comments**: list, add form, live updates via `request:comment_added`
- [ ] **(extra)** Admin page: create users, change roles, deactivate (small table and form)
- [ ] UX polish:
  - [ ] Consistent loading skeletons, empty states, and error messages
  - [ ] Keyboard accessibility and visible focus states, labeled form fields
  - [ ] Test at 360px, 768px, 1280px widths
  - [ ] Dark mode **(optional)**
  - [ ] Relative timestamps with tooltips (`2 min ago`)
- [ ] Security pass: no tokens in storage or URLs, no `dangerouslySetInnerHTML`, XSS check (submit `<script>` text and confirm it renders as plain text)
- [ ] **(bonus)** Frontend tests: component tests for the form and the progress bar, plus one Playwright end-to-end flow
- [ ] Tag the milestone: `git tag frontend-complete`

**Done when:** all pages are complete, responsive, and the full flow works for operator, supervisor, and admin.

**Commits**
- `feat(frontend): add request detail page with history timeline`
- `feat(frontend): add live comments`
- `feat(frontend): add admin user management page`
- `style(frontend): responsive, accessibility and empty/error states polish`
- `test(frontend): add component and e2e tests`

---

# PART D: Delivery

## Phase 14: Production Docker, CI/CD, and deployment

### 14A. Production containers

- [ ] Backend `prod` target: multi-stage, non-root user, only production deps, compiled JS
- [ ] Frontend `prod` target: static build served by Nginx
- [ ] `nginx/nginx.conf` for the production proxy:
  - [ ] Serves the frontend, proxies `/api` and `/socket.io` to the API
  - [ ] WebSocket upgrade headers
  - [ ] Gzip, security headers, request size and rate limits, `server_tokens off`
- [ ] `docker-compose.prod.yml` (override or separate):
  - [ ] Only Nginx publishes ports
  - [ ] No bind mounts, restart policies (`unless-stopped`), healthchecks
  - [ ] Resource limits for containers
  - [ ] Worker replicas (e.g., 2)
  - [ ] Separate DB users (app vs migrate)
- [ ] `migrate` one-shot service runs migrations and the first seed before the API starts
- [ ] Test the full prod stack locally: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build`
- [ ] Image scan with Trivy and fix high or critical issues **(bonus)**

### 14B. CI pipeline (GitHub Actions) **(bonus)**

- [ ] Workflow `ci.yml` on push and pull request:
  - [ ] Install, lint, typecheck
  - [ ] Run tests with MariaDB and Redis service containers
  - [ ] `npm audit` for production dependencies
  - [ ] gitleaks secret scan
  - [ ] Build Docker images
- [ ] Add status badge to README
- [ ] Branch protection on `main` requiring CI

### 14C. Deployment **(bonus)**

- [ ] Prepare the VPS: Docker installed, firewall (22, 80, 443), SSH key-only, `fail2ban`
- [ ] Domain DNS pointing to the server; TLS via Let's Encrypt (certbot or a Caddy/Traefik alternative)
- [ ] Production `.env` stored on the server only
- [ ] Deploy workflow: build and push images, then SSH and `docker compose pull && up -d`
- [ ] Database backup script (cron) with a tested restore
- [ ] Smoke test the live URL: login, create request, watch live updates over WSS

**Done when:** the whole system starts from a clean machine with a single documented command, and (if attempted) runs live over HTTPS.

**Commits**
- `build: add production dockerfiles and nginx config`
- `build: add production compose with healthchecks and limits`
- `ci: add github actions pipeline`
- `ci: add deployment workflow`

---

## Phase 15: Final documentation and submission

### 15A. README (required)

- [ ] Project overview and screenshots or a short GIF of live updates
- [ ] Architecture overview with the diagram
- [ ] Technology stack and why
- [ ] Assumptions and scope
- [ ] Prerequisites (Docker, Git)
- [ ] **Quick start:** `git clone`, `cp .env.example .env`, `docker compose up --build`, URLs and demo credentials
- [ ] Environment variables table
- [ ] Database setup (migrations, seed) and how to reset
- [ ] Build and run instructions (dev and prod)
- [ ] How to run tests
- [ ] API documentation (table plus link to `/api/docs`)
- [ ] WebSocket events table with payload examples
- [ ] Concurrency model explanation and how to demo it (`--scale worker=3`, load script)
- [ ] Security summary and OWASP mapping
- [ ] Known limitations and future work
- [ ] Project structure tree

### 15B. Documents and cleanliness

- [ ] Update `docs/01-system-analysis.md` and `docs/02-system-design.md` to match what was actually built (the PDF asks that implementation aligns with the design)
- [ ] Make sure all diagrams render on GitHub
- [ ] Remove unused files, secrets, and debug code; run the secret scan again
- [ ] Verify `.env.example` has every required variable and no real secrets

### 15C. Final verification (fresh machine test)

- [ ] Clone the repo into a **new folder**, follow only the README, and confirm it runs
- [ ] `docker compose down -v` then up again: migrations and seed work from scratch
- [ ] Run the full test suite inside Docker
- [ ] Walk through the demo script:
  1. Open operator and supervisor in two browsers
  2. Create several requests, including one urgent
  3. Watch them appear live and progress in parallel
  4. Cancel one mid-processing
  5. Let one fail, then retry it as a supervisor
  6. Restart the API container and show reconnect recovery
  7. Show logs, tests, and the CI badge
- [ ] Check responsiveness on a phone-sized viewport

### 15D. Git and submission

- [ ] Review commit history for meaningful messages; at least 40 commits spread across the work
- [ ] Merge all work into `main`; tag `v1.0.0`
- [ ] Push to GitHub; confirm CI is green
- [ ] Record a short demo video **(optional but helpful)**
- [ ] Prepare the submission message: repo link, how to run, demo credentials, the list of extras implemented
- [ ] Check the PDF's deliverables one final time:
  - [ ] System analysis document
  - [ ] System design (architecture diagram, component diagram, ERD, API design, WebSocket flow, concurrency model, stack justification)
  - [ ] Working implementation (REST, WebSockets, concurrency, persistent DB, responsive UI)
  - [ ] README with all required sections

**Commits**
- `docs: complete readme with setup, api and websocket documentation`
- `docs: align analysis and design documents with implementation`
- `chore: final cleanup and release v1.0.0`

---

# Appendix

## A. Daily routine that keeps the project on track

1. Pull latest, start the stack (`make up`).
2. Pick **one** task from the current phase; create a branch.
3. Write the test (or manual check), then the code.
4. Commit small with a clear message; push.
5. End the day by ticking boxes here and writing tomorrow's first task at the top of a `NOTES.md` file.

## B. Suggested weekly plan (if you have about 4 weeks)

| Week | Focus |
|---|---|
| 1 | Phases 0 to 3, and start of Phase 4 (docs, Docker, backend skeleton and DB) |
| 2 | Phases 4 to 7 (auth, REST API, workers, WebSockets) |
| 3 | Phases 8 to 12 (backend hardening, frontend through the live dashboard) |
| 4 | Phases 13 to 15 (detail page, polish, production Docker, docs, submission) |

For a tighter deadline, compress by following the **minimum viable path** below.

## C. Minimum viable path (if time is short)

Must have for the PDF requirements:

- Phase 1 (docs), Phase 2 (Docker), Phase 3 (foundation)
- Phase 4 (simplified: login with one access token, roles)
- Phase 5 (all REST endpoints)
- Phase 6 (queue, workers, concurrency)
- Phase 7 (sockets with rooms; reconnect sync can be a simple full refetch)
- Phases 9 to 12 (frontend with live dashboard)
- Phase 15 (README and verification)

**Cut first (in this order):** CI/CD and deployment, metrics, Playwright tests, admin page, refresh-token rotation, comments, event-based reconnect sync, dark mode.

**Never cut:** analysis and design documents, validation and error handling, state machine, background workers, WebSocket updates without polling, README with setup and API/WebSocket docs, meaningful Git history.

## D. Common Docker problems and quick fixes

| Problem | Likely cause | Fix |
|---|---|---|
| API starts before DB is ready | No healthcheck dependency | Use `depends_on: condition: service_healthy` |
| Code changes do not reload | Bind mount missing, or file events not detected | Check volume paths; enable polling (`CHOKIDAR_USEPOLLING` / Vite `watch.usePolling`) |
| `node_modules` missing or wrong platform | Host folder overwriting the container's | Add an anonymous volume for `/app/node_modules` |
| Migration fails on a fresh DB | App connecting before MariaDB initialization finishes | Run migrations in a `migrate` service that waits for the healthcheck |
| WebSocket connects in dev but not behind Nginx | Missing upgrade headers | Add `proxy_set_header Upgrade $http_upgrade;` and `Connection "upgrade"` |
| Frontend cannot reach API from the browser | Using the Docker service name in the browser URL | The browser runs on your host: use `http://localhost:4000` (or the proxy path), not `http://api:4000` |
| CORS errors | Origin not in allowlist | Set `CORS_ORIGIN` to the exact frontend origin |
| Files owned by root on the host | Container ran as root with a bind mount | Run as a non-root user with a matching UID, or fix permissions |
| Data lost after restart | No named volume | Use named volumes for MariaDB and Redis |
| Port already in use | Another local service | Change the host port mapping in Compose |

## E. Definition of done (for every task)

- Code compiles and lints cleanly
- Tests written and passing (or a documented manual check for UI work)
- Input validated and errors handled
- Authorization considered (who may do this?)
- Logs added for important events
- Docs or README updated if behavior changed
- Committed with a meaningful message