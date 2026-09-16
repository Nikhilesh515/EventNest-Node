import type { Express } from 'express';
import express from 'express';
import { pino, type Logger } from 'pino';
import type { Knex } from 'knex';
import { buildKnex, destroyKnex } from '../../src/shared/infrastructure/db/knex.js';
import { buildAuthModule } from '../../src/modules/auth/module.js';
import { buildTagsModule } from '../../src/modules/tags/module.js';
import { buildEventsModule } from '../../src/modules/events/module.js';
import { buildRsvpsModule } from '../../src/modules/rsvps/module.js';
import type { RsvpStatsPort } from '../../src/modules/rsvps/application/ports/rsvp-stats.port.js';
import { errorHandler } from '../../src/shared/http/middleware/error-handler.js';
import { notFound } from '../../src/shared/http/middleware/not-found.js';
import { requestId } from '../../src/shared/http/middleware/request-id.js';
import { requestLogger } from '../../src/shared/http/middleware/request-logger.js';
import { securityHeaders } from '../../src/shared/http/middleware/helmet.js';
import { compress } from '../../src/shared/http/middleware/compress.js';
import { healthHandler } from '../../src/shared/http/health.js';
import { mountApiDocs } from '../../src/shared/http/openapi/serve.js';
import type { CachePort } from '../../src/shared/application/ports/cache-port.js';
import { loadConfig, type AppConfig } from '../../src/config/env.js';

export interface TestAppContext {
  app: Express;
  knex: Knex;
  config: AppConfig;
  logger: Logger;
  cache: CachePort;
}

export function testConfig(overrides: Record<string, string> = {}): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5433/eventnest_test',
    JWT_SECRET: 'test-secret-value-0123456789abcdef',
    JWT_ISSUER: 'EventNest.AuthService',
    JWT_AUDIENCE: 'EventNest',
    JWT_ACCESS_EXPIRY_MINUTES: '60',
    JWT_REFRESH_EXPIRY_DAYS: '30',
    REFRESH_ROTATION_GRACE_SECONDS: '0',
    LOG_LEVEL: 'silent',
    ...overrides,
  } as NodeJS.ProcessEnv);
}

export function testLogger(): Logger {
  const level = process.env.TEST_LOG_LEVEL ?? 'silent';
  return pino({ level });
}

export function createInMemoryCache(): CachePort {
  const store = new Map<string, { value: unknown; expiresAt: number | null }>();

  return {
    async get<T>(key: string): Promise<T | null> {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value as T;
    },
    async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
      const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
      store.set(key, { value, expiresAt });
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
    async close(): Promise<void> {
      store.clear();
    },
  };
}

let sharedCtx: TestAppContext | null = null;

export async function buildTestApp(config: AppConfig): Promise<TestAppContext> {
  const logger = testLogger();
  const knex = buildKnex(config.DATABASE_URL);
  const cache = createInMemoryCache();

  process.env.JWT_SECRET = config.JWT_SECRET;
  process.env.JWT_ISSUER = config.JWT_ISSUER;
  process.env.JWT_AUDIENCE = config.JWT_AUDIENCE;

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

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(requestId());
  app.use(requestLogger(logger));
  app.use(securityHeaders());
  app.use(compress());
  app.use(express.json({ limit: '100kb', strict: true }));

  app.get('/health', healthHandler({ knex, redisClient: null }));
  mountApiDocs(app, false);

  for (const modRouter of authModule.routers) {
    app.use(modRouter);
  }
  for (const modRouter of tagsModule.routers) {
    app.use(modRouter);
  }
  for (const modRouter of eventsModule.routers) {
    app.use(modRouter);
  }
  for (const modRouter of rsvpsHolder.module!.routers) {
    app.use(modRouter);
  }

  app.use(notFound());
  app.use(errorHandler(logger));

  return { app, knex, config, logger, cache };
}

export async function destroyTestApp(ctx: TestAppContext): Promise<void> {
  await ctx.cache.close();
  await destroyKnex(ctx.knex);
}

export async function getSharedTestApp(): Promise<TestAppContext> {
  if (sharedCtx) return sharedCtx;

  sharedCtx = await buildTestApp(testConfig());
  return sharedCtx;
}

export async function destroySharedTestApp(): Promise<void> {
  if (!sharedCtx) return;
  const ctx = sharedCtx;
  sharedCtx = null;
  await destroyTestApp(ctx);
}

export async function resetTestData(knex: Knex): Promise<void> {
  await knex('refresh_tokens').del();
  await knex('permission_grants').del();
  await knex('rsvps').del();
  await knex('event_tags').del();
  await knex('events')
    .whereNotIn('title', ['Tech Meetup 2026', 'Food Festival', 'Music Concert'])
    .del();
  await knex('users').where('email', 'like', '%@test.example.com').del();
  await knex('tags')
    .whereNotIn('name', ['Technology', 'Music', 'Food & Drink', 'Sports', 'Networking'])
    .del();
  await knex('role_permissions')
    .whereNotIn('role_id', function () {
      this.select('id')
        .from('roles')
        .whereIn('name', ['User', 'Organizer', 'Moderator', 'Admin', 'SuperAdmin']);
    })
    .del();
  await knex('roles')
    .whereNotIn('name', ['User', 'Organizer', 'Moderator', 'Admin', 'SuperAdmin'])
    .del();
}
