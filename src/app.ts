import express, { type Express, type Router } from 'express';
import type { Logger } from 'pino';
import type { AppConfig } from './config/env.js';
import { errorHandler } from './shared/http/middleware/error-handler.js';
import { notFound } from './shared/http/middleware/not-found.js';
import { requestId } from './shared/http/middleware/request-id.js';
import { requestLogger } from './shared/http/middleware/request-logger.js';

export interface AppDependencies {
  config: AppConfig;
  logger: Logger;
  router?: Router;
}

export function createApp(deps: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(requestId());
  app.use(requestLogger(deps.logger));
  app.use(express.json({ limit: '100kb', strict: true }));

  app.get('/health', (_request, response) => {
    response.status(200).json({ status: 'Healthy', checks: [] });
  });

  if (deps.router) {
    app.use(deps.router);
  }

  app.use(notFound());
  app.use(errorHandler(deps.logger));

  deps.logger.debug({ env: deps.config.NODE_ENV }, 'express app created');

  return app;
}
