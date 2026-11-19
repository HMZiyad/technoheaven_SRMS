# ADR 005: Stateless JWT with Redis Token Revocation Denylist

## Status
Accepted

## Context
Standard JWTs cannot be invalidated immediately upon user logout or account deactivation, posing a security risk. Full database session lookups on every request add database latency.

## Decision
- We use short-lived HS256 JWT access tokens (15 minutes).
- Each token contains a unique UUID `jti` (JWT ID).
- Upon logout (`POST /api/v1/auth/logout`), the `jti` is stored in Redis with an expiration matching the token's remaining lifetime.
- Authentication middleware performs an in-memory Redis `EXISTS` check.

## Consequences
- Fast authentication with immediate token revocation capabilities.
