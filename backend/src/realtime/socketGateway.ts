import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Role, AuthUser, JwtPayload } from '../types';
import { verifyAccessToken } from '../utils/token';
import { authService } from '../services/auth.service';
import { userRepository } from '../repositories/user.repository';
import { requestRepository } from '../repositories/request.repository';
import { canViewRequest } from '../domain/policy';
import { getRedisClient } from '../db/redis';
import { EventEnvelope } from './events';
import { EVENT_CHANNEL } from './eventPublisher';

let ioInstance: SocketIOServer | null = null;
let subscriberInstance: Redis | null = null;

export function getIo(): SocketIOServer {
  if (!ioInstance) {
    throw new Error('Socket.IO gateway has not been initialized');
  }
  return ioInstance;
}

/**
 * Initializes the Socket.IO gateway, attaches authentication middleware,
 * room subscriptions, and sets up Redis pub/sub routing.
 */
export async function initSocketGateway(server: http.Server): Promise<SocketIOServer> {
  const io = new SocketIOServer(server, {
    cors: {
      origin: config.CORS_ORIGIN,
      credentials: true,
    },
  });

  ioInstance = io;

  // Authentication middleware
  io.use(async (socket: Socket, next: (err?: Error) => void) => {
    try {
      const authHeader = socket.handshake.headers?.authorization;
      let token: string | undefined = socket.handshake.auth?.token;

      if (!token && authHeader) {
        if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
          token = authHeader.slice(7).trim();
        } else if (typeof authHeader === 'string') {
          token = authHeader.trim();
        }
      }

      if (!token) {
        return next(new Error('Authentication required'));
      }

      let payload: JwtPayload;
      try {
        payload = await verifyAccessToken(token);
      } catch {
        return next(new Error('Invalid or expired token'));
      }

      const isRevoked = await authService.isTokenRevoked(payload.jti);
      if (isRevoked) {
        return next(new Error('Token has been revoked'));
      }

      const user = await userRepository.findById(payload.sub);
      if (!user || !user.active) {
        return next(new Error('User not found or inactive'));
      }

      socket.data.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as Role,
      };

      next();
    } catch (err: any) {
      logger.error({ err }, 'Socket authentication error');
      next(new Error(err?.message || 'Authentication required'));
    }
  });

  // Client connection handler
  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as AuthUser;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    logger.info({ userId: user.id, socketId: socket.id }, 'Socket client connected');

    // Join user's private notification room
    socket.join(`user:${user.id}`);

    // If supervisor or admin, join supervisor room
    if (user.role === Role.SUPERVISOR || user.role === Role.ADMIN) {
      socket.join('role:supervisor');
    }

    // Subscribe to detailed request updates
    socket.on('request:subscribe', async (data: { requestId: string }) => {
      try {
        if (!data || !data.requestId || typeof data.requestId !== 'string') {
          return;
        }

        const request = await requestRepository.findById(data.requestId);
        if (!request) {
          return;
        }

        if (canViewRequest(user, request)) {
          socket.join(`request:${data.requestId}`);
          logger.debug({ userId: user.id, requestId: data.requestId }, 'Joined request room');
        } else {
          logger.warn({ userId: user.id, requestId: data.requestId }, 'Unauthorized request subscription');
        }
      } catch (err) {
        logger.error({ err, requestId: data?.requestId }, 'Error handling request:subscribe');
      }
    });

    // Unsubscribe from request room
    socket.on('request:unsubscribe', (data: { requestId: string }) => {
      try {
        if (data && data.requestId && typeof data.requestId === 'string') {
          socket.leave(`request:${data.requestId}`);
          logger.debug({ userId: user.id, requestId: data.requestId }, 'Left request room');
        }
      } catch (err) {
        logger.error({ err, requestId: data?.requestId }, 'Error handling request:unsubscribe');
      }
    });

    socket.on('disconnect', (reason) => {
      logger.debug({ userId: user.id, socketId: socket.id, reason }, 'Socket client disconnected');
    });
  });

  // Redis event subscriber
  const redis = getRedisClient();
  const subscriber = redis.duplicate();
  subscriberInstance = subscriber;

  subscriber.on('error', (err: Error) => {
    logger.error({ err }, 'Redis subscriber error in socket gateway');
  });

  await subscriber.subscribe(EVENT_CHANNEL);

  subscriber.on('message', (_channel: string, message: string) => {
    try {
      const event: EventEnvelope = JSON.parse(message);

      // 1. Emit to role:supervisor (supervisors get all request events and stats)
      io.to('role:supervisor').emit(event.type, event);

      // 2. If event.requestId: emit to request:${event.requestId}
      if (event.requestId) {
        io.to(`request:${event.requestId}`).emit(event.type, event);
      }

      // 3. If event.targetUserId: emit to user:${event.targetUserId}
      if (event.targetUserId) {
        io.to(`user:${event.targetUserId}`).emit(event.type, event);
      }

      // 4. If audience is 'all' and not tied to a single request or user, broadcast to all
      if (event.audience === 'all' && !event.requestId && !event.targetUserId) {
        io.emit(event.type, event);
      }
    } catch (err) {
      logger.error({ err, message }, 'Failed to parse or route redis event envelope');
    }
  });

  return io;
}

/**
 * Closes the Socket.IO gateway and disconnects the redis subscriber.
 */
export async function closeSocketGateway(): Promise<void> {
  if (subscriberInstance) {
    try {
      await subscriberInstance.unsubscribe(EVENT_CHANNEL);
      await subscriberInstance.quit();
    } catch (err) {
      logger.error({ err }, 'Error closing Redis subscriber');
    }
    subscriberInstance = null;
  }

  if (ioInstance) {
    ioInstance.close();
    ioInstance = null;
  }
}
