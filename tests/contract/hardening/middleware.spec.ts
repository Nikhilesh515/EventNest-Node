import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  getSharedTestApp,
  destroySharedTestApp,
  type TestAppContext,
} from '../../helpers/test-setup.js';
import { loginUser } from '../../helpers/auth-helpers.js';
import { createApp } from '../../../src/app.js';
import { testConfig, testLogger } from '../../helpers/app.js';
import { buildKnex } from '../../../src/shared/infrastructure/db/knex.js';
import { healthHandler } from '../../../src/shared/http/health.js';
import { buildRateLimiter } from '../../../src/shared/http/middleware/rate-limiter.js';

let ctx: TestAppContext;
let adminToken: string;

beforeAll(async () => {
  ctx = await getSharedTestApp();
  const admin = await loginUser(ctx.app, 'admin@eventnest.io', 'Admin@123');
  adminToken = admin.accessToken;
});

afterAll(async () => {
  await destroySharedTestApp();
});

describe('GET /health', () => {
  it('returns 200 with healthy status', async () => {
    const res = await request(ctx.app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Healthy');
    expect(Array.isArray(res.body.checks)).toBe(true);
  });

  it('returns checks array with postgres check', async () => {
    const res = await request(ctx.app).get('/health');

    const names = res.body.checks.map((c: { name: string }) => c.name);
    expect(names).toContain('postgres');
  });

  it('each check has name, status, and durationMs', async () => {
    const res = await request(ctx.app).get('/health');

    for (const check of res.body.checks) {
      expect(typeof check.name).toBe('string');
      expect(['Healthy', 'Unhealthy', 'Skipped']).toContain(check.status);
      expect(typeof check.durationMs).toBe('number');
    }
  });

  it('does not require authentication', async () => {
    const res = await request(ctx.app).get('/health');

    expect(res.status).toBe(200);
  });
});

describe('Security headers', () => {
  it('includes x-content-type-options: nosniff', async () => {
    const res = await request(ctx.app).get('/api/tags');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('includes x-frame-options', async () => {
    const res = await request(ctx.app).get('/api/tags');

    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('does not expose x-powered-by', async () => {
    const res = await request(ctx.app).get('/api/tags');

    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('Rate limiting', () => {
  it('allows requests within limit', async () => {
    const res = await request(ctx.app)
      .get('/api/tags')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  it('does not rate-limit /health', async () => {
    const res = await request(ctx.app).get('/health');

    expect(res.status).toBe(200);
    expect(res.status).not.toBe(429);
  });
});

describe('OpenAPI', () => {
  it('GET /api-docs/json returns OpenAPI spec when enabled', async () => {
    const knex = buildKnex(testConfig().DATABASE_URL);
    const config = { ...testConfig(), OPENAPI_ENABLED: true };
    const app = createApp({
      config,
      logger: testLogger(),
      health: { knex, redisClient: null },
      rateLimiter: buildRateLimiter(config.RATE_LIMIT_PER_MINUTE),
    });

    const res = await request(app).get('/api-docs/json');

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBeDefined();
    expect(res.body.info?.title).toBe('EventNest API');

    await knex.destroy();
  });
});
