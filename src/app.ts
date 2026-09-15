import express, { type Express, type Router, type RequestHandler } from 'express';
import cors from 'cors';
import type { Logger } from 'pino';
import type { AppConfig } from './config/env.js';
import { errorHandler } from './shared/http/middleware/error-handler.js';
import { notFound } from './shared/http/middleware/not-found.js';
import { requestId } from './shared/http/middleware/request-id.js';
import { requestLogger } from './shared/http/middleware/request-logger.js';
import { securityHeaders } from './shared/http/middleware/helmet.js';
import { compress } from './shared/http/middleware/compress.js';
import { healthHandler, type HealthDeps } from './shared/http/health.js';
import { mountApiDocs } from './shared/http/openapi/serve.js';

export interface AppDependencies {
  config: AppConfig;
  logger: Logger;
  router?: Router;
  rateLimiter?: RequestHandler;
  health?: HealthDeps;
}

export function createApp(deps: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);

  const noopHandler: RequestHandler = (_req, _res, next) => next();

  app.use(requestId());
  app.use(requestLogger(deps.logger));
  app.use(securityHeaders());
  app.use(
    cors({
      origin: deps.config.CORS_ORIGINS,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'Location', 'Retry-After'],
      credentials: false,
    }),
  );
  app.use(deps.rateLimiter ?? noopHandler);
  app.use(compress());
  app.use(express.json({ limit: '100kb', strict: true }));

  if (deps.health) {
    app.get('/health', healthHandler(deps.health));
  } else {
    app.get('/health', (_req, res) => {
      res.status(200).json({ status: 'Healthy', checks: [] });
    });
  }
  mountApiDocs(app, deps.config.OPENAPI_ENABLED);

  if (deps.router) {
    app.use(deps.router);
  }

  app.use(notFound());
  app.use(errorHandler(deps.logger));

  deps.logger.debug({ env: deps.config.NODE_ENV }, 'express app created');

  return app;
}
