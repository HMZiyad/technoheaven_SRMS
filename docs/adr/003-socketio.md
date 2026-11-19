# ADR 003: Socket.IO with Redis Pub/Sub for Real-Time Updates

## Status
Accepted

## Context
Supervisors need to view live progress and status changes without polling the database or refreshing their browsers. Operators should receive updates only for their own requests.

## Decision
We adopted **Socket.IO** connected to a Redis Pub/Sub channel (`srms:events`):
- Background workers publish progress and status updates to Redis.
- The API gateway subscribes to Redis and dispatches events to Socket.IO rooms.
- Room isolation:
  - `user:<id>`: Personal updates for operators.
  - `role:supervisor`: System-wide feed for supervisors and admins.
  - `request:<id>`: Detail page updates for subscribed viewers.

## Consequences
- Zero HTTP polling load.
- Strict authorization prevents operators from receiving sensitive events belonging to others.
