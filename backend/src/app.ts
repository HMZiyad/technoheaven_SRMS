import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { config } from './config';
import { logger } from './utils/logger';
import { requestId } from './middleware/requestId';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { healthRouter } from './controllers/health.controller';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: config.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'],
    }),
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(requestId);
  app.use(pinoHttp({ logger, customLogLevel: (_req: express.Request, res: express.Response) => (res.statusCode >= 500 ? 'error' : 'info') }));

  app.use('/api/v1/health', healthRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
