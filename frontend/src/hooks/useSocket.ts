import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { EventEnvelope } from '../types';

export type SocketStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface UseSocketOptions {
  onEvent?: (event: EventEnvelope) => void;
  onRequestCreated?: (event: EventEnvelope) => void;
  onRequestStatusChanged?: (event: EventEnvelope) => void;
  onRequestProgress?: (event: EventEnvelope) => void;
  onRequestUpdated?: (event: EventEnvelope) => void;
  onRequestCommentAdded?: (event: EventEnvelope) => void;
  onStatsUpdated?: (event: EventEnvelope) => void;
}

const WS_BASE_URL =
  import.meta.env.VITE_WS_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:4000';

let globalSocket: Socket | null = null;
const activeListeners = new Set<(event: EventEnvelope) => void>();
const statusListeners = new Set<(status: SocketStatus) => void>();
let currentStatus: SocketStatus = 'disconnected';

function setGlobalStatus(status: SocketStatus) {
  currentStatus = status;
  statusListeners.forEach((listener) => listener(status));
}

export function getGlobalSocket(): Socket | null {
  return globalSocket;
}

export function useSocket(options?: UseSocketOptions) {
  const token = useAuthStore((state) => state.token);
  const [status, setStatus] = useState<SocketStatus>(currentStatus);
  const [lastEvent, setLastEvent] = useState<EventEnvelope | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const handleStatus = (newStatus: SocketStatus) => setStatus(newStatus);
    statusListeners.add(handleStatus);
    setStatus(currentStatus);
    return () => {
      statusListeners.delete(handleStatus);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      if (globalSocket) {
        globalSocket.disconnect();
        globalSocket = null;
        setGlobalStatus('disconnected');
      }
      return;
    }

    if (!globalSocket || globalSocket.disconnected) {
      const socket = io(WS_BASE_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      globalSocket = socket;
      setGlobalStatus('reconnecting');

      socket.on('connect', () => {
        setGlobalStatus('connected');
      });

      socket.on('disconnect', (reason) => {
        if (reason === 'io client disconnect') {
          setGlobalStatus('disconnected');
        } else {
          setGlobalStatus('reconnecting');
        }
      });

      socket.on('connect_error', () => {
        setGlobalStatus('reconnecting');
      });

      socket.io.on('reconnect_attempt', () => {
        setGlobalStatus('reconnecting');
      });

      socket.io.on('reconnect', () => {
        setGlobalStatus('connected');
      });

      const DOMAIN_EVENTS = [
        'request:created',
        'request:status_changed',
        'request:progress',
        'request:updated',
        'request:comment_added',
        'stats:updated',
      ];

      DOMAIN_EVENTS.forEach((eventName) => {
        socket.on(eventName, (event: EventEnvelope) => {
          activeListeners.forEach((fn) => fn(event));
        });
      });
    }

    return () => {
      // Keep global connection alive across component unmounts unless explicitly disconnected
    };
  }, [token]);

  useEffect(() => {
    const handleEvent = (event: EventEnvelope) => {
      setLastEvent(event);

      const opts = optionsRef.current;
      if (!opts) return;

      opts.onEvent?.(event);

      switch (event.type) {
        case 'request:created':
          opts.onRequestCreated?.(event);
          break;
        case 'request:status_changed':
          opts.onRequestStatusChanged?.(event);
          break;
        case 'request:progress':
          opts.onRequestProgress?.(event);
          break;
        case 'request:updated':
          opts.onRequestUpdated?.(event);
          break;
        case 'request:comment_added':
          opts.onRequestCommentAdded?.(event);
          break;
        case 'stats:updated':
          opts.onStatsUpdated?.(event);
          break;
      }
    };

    activeListeners.add(handleEvent);
    return () => {
      activeListeners.delete(handleEvent);
    };
  }, []);

  const subscribeToRequest = useCallback((requestId: string) => {
    if (globalSocket && globalSocket.connected) {
      globalSocket.emit('request:subscribe', { requestId });
    } else if (globalSocket) {
      globalSocket.once('connect', () => {
        globalSocket?.emit('request:subscribe', { requestId });
      });
    }
  }, []);

  const unsubscribeFromRequest = useCallback((requestId: string) => {
    if (globalSocket) {
      globalSocket.emit('request:unsubscribe', { requestId });
    }
  }, []);

  return {
    status,
    isConnected: status === 'connected',
    isReconnecting: status === 'reconnecting',
    isDisconnected: status === 'disconnected',
    lastEvent,
    subscribeToRequest,
    unsubscribeFromRequest,
    socket: globalSocket,
  };
}

export default useSocket;
