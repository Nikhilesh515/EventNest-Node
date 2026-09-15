import { config as loadDotenv } from 'dotenv';
import { Router } from 'express';
import { createApp } from './app.js';
import { ConfigError, loadConfig, type AppConfig } from './config/env.js';
import { createLogger } from './shared/infrastructure/logger.js';
import { exitAfterFlush } from './shared/infrastructure/exit.js';
import { registerShutdownHandlers } from './shared/infrastructure/shutdown.js';
import { buildKnex, destroyKnex } from './shared/infrastructure/db/knex.js';
import { createCache } from './shared/infrastructure/cache/create-cache.js';
import { buildAuthModule } from './modules/auth/module.js';

function bootstrap(): void {
  if (process.env.NODE_ENV !== 'production') {
    loadDotenv({ quiet: true });
  }

  let config: AppConfig;
  try {
    config = loadConfig();
  } catch (error) {
    const message = error instanceof ConfigError ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
    return;
  }

  const logger = createLogger(config);

  const knex = buildKnex(config.DATABASE_URL);
  const cache = createCache(config, logger);

  const authModule = buildAuthModule({ knex, config, logger, cache });

  const router = Router();
  for (const modRouter of authModule.routers) {
    router.use(modRouter);
  }

  const app = createApp({ config, logger, router });

  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT, env: config.NODE_ENV }, 'eventnest-api listening');
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      logger.fatal({ port: config.PORT }, 'port is already in use');
    } else {
      logger.fatal({ err: error }, 'http server error');
    }
    exitAfterFlush(logger, 1);
  });

  registerShutdownHandlers(server, logger, async () => {
    await cache.close();
    logger.info('cache connection closed');
    await destroyKnex(knex);
    logger.info('database connection closed');
  });
}

bootstrap();
