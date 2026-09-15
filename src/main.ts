import { config as loadDotenv } from 'dotenv';
import { Router } from 'express';
import { createApp } from './app.js';
import { ConfigError, loadConfig, type AppConfig } from './config/env.js';
import { createLogger } from './shared/infrastructure/logger.js';
import { exitAfterFlush } from './shared/infrastructure/exit.js';
import { registerShutdownHandlers } from './shared/infrastructure/shutdown.js';
import { buildKnex, destroyKnex } from './shared/infrastructure/db/knex.js';
import { createCache, createRedisClient } from './shared/infrastructure/cache/create-cache.js';
import { buildRateLimiter } from './shared/http/middleware/rate-limiter.js';
import { buildAuthModule } from './modules/auth/module.js';
import { buildTagsModule } from './modules/tags/module.js';
import { buildEventsModule } from './modules/events/module.js';
import { buildRsvpsModule } from './modules/rsvps/module.js';
import type { RsvpStatsPort } from './modules/rsvps/application/ports/rsvp-stats.port.js';

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
  const tagsModule = buildTagsModule({ knex, config, logger });

  const rsvpsHolder: { module: ReturnType<typeof buildRsvpsModule> | null } = { module: null };
  const rsvpStats: RsvpStatsPort = {
    getGoingCounts: (ids) => rsvpsHolder.module!.providers.rsvpStats.getGoingCounts(ids),
    getMaybeCounts: (ids) => rsvpsHolder.module!.providers.rsvpStats.getMaybeCounts(ids),
  };

  const eventsModule = buildEventsModule({
    knex,
    config,
    logger,
    tagLookup: tagsModule.services.tags,
    userLookup: authModule.providers.userLookup,
    rsvpStats,
  });

  rsvpsHolder.module = buildRsvpsModule({
    knex,
    config,
    logger,
    eventLookup: eventsModule.providers.eventLookup,
    userLookup: authModule.providers.userLookup,
  });

  const router = Router();
  for (const modRouter of authModule.routers) {
    router.use(modRouter);
  }
  for (const modRouter of tagsModule.routers) {
    router.use(modRouter);
  }
  for (const modRouter of eventsModule.routers) {
    router.use(modRouter);
  }
  for (const modRouter of rsvpsHolder.module!.routers) {
    router.use(modRouter);
  }

  const rateLimiter = buildRateLimiter(config.RATE_LIMIT_PER_MINUTE);
  const redisClient = config.REDIS_URL ? createRedisClient(config.REDIS_URL, logger) : null;

  const app = createApp({
    config,
    logger,
    router,
    rateLimiter,
    health: { knex, redisClient },
  });

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
    if (redisClient) {
      await redisClient.quit();
      logger.info('redis connection closed');
    }
    await cache.close();
    logger.info('cache connection closed');
    await destroyKnex(knex);
    logger.info('database connection closed');
  });
}

bootstrap();
