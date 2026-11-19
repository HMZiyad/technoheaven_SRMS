# ADR 001: Technology Stack Selection

## Status
Accepted

## Context
The system requires real-time capabilities, background asynchronous processing, relational data integrity, and a responsive web dashboard. Reviewers and operators need to be able to run the entire system with minimal prerequisites.

## Decision
We chose:
- **TypeScript & Node.js 20**: Unified language front-and-back with shared types and mature real-time ecosystem.
- **Express**: Lightweight, robust, and modular HTTP framework.
- **MariaDB 11**: Relational ACID database with strong constraints, indexing, and fulltext search.
- **Prisma ORM**: Declarative schema, automated migrations, type-safe queries.
- **BullMQ & Redis 7**: In-memory job queue with persistence, priority sorting, concurrency control, and pub/sub.
- **Socket.IO**: Real-time bidirectional event communication with room-based routing.
- **React, Vite & Tailwind CSS**: Modern component-driven UI with instant HMR and utility styling.
- **Docker Compose**: Containerized multi-service orchestration for one-command bootstrapping.

## Consequences
- Single language reduces context switching.
- Standardized container deployment ensures zero environment disparity.
