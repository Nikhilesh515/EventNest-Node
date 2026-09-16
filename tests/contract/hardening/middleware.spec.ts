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

  it('documents cookie-based refresh and logout without request bodies', async () => {
    const knex = buildKnex(testConfig().DATABASE_URL);
    const config = { ...testConfig(), OPENAPI_ENABLED: true };
    const app = createApp({
      config,
      logger: testLogger(),
      health: { knex, redisClient: null },
      rateLimiter: buildRateLimiter(config.RATE_LIMIT_PER_MINUTE),
    });

    const res = await request(app).get('/api-docs/json');
    const doc = res.body;

    expect(doc.components?.securitySchemes?.refreshCookie).toEqual({
      type: 'apiKey',
      in: 'cookie',
      name: 'eventnest.refresh_token',
    });

    const refresh = doc.paths['/api/auth/refresh'].post;
    expect(refresh.requestBody).toBeUndefined();
    expect(refresh.security).toEqual([{ refreshCookie: [] }]);
    expect(refresh.responses['401']).toBeDefined();
    expect(refresh.responses['403']).toBeDefined();
    expect(refresh.responses['200'].headers['Set-Cookie']).toBeDefined();

    const logout = doc.paths['/api/auth/logout'].post;
    expect(logout.requestBody).toBeUndefined();
    expect(logout.security).toEqual([{ refreshCookie: [] }]);
    expect(logout.responses['204']).toBeDefined();
    expect(logout.responses['403']).toBeDefined();

    await knex.destroy();
  });
});

describe('CORS credentials', () => {
  it('allows credentials for an allowlisted origin and never echoes a wildcard', async () => {
    const knex = buildKnex(testConfig().DATABASE_URL);
    const config = { ...testConfig(), CORS_ORIGINS: ['http://localhost:5173'] };
    const app = createApp({
      config,
      logger: testLogger(),
      health: { knex, redisClient: null },
      rateLimiter: buildRateLimiter(config.RATE_LIMIT_PER_MINUTE),
    });

    const res = await request(app)
      .options('/api/auth/refresh')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');

    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).not.toBe('*');

    await knex.destroy();
  });

  it('does not allow credentials for a disallowed origin', async () => {
    const knex = buildKnex(testConfig().DATABASE_URL);
    const config = { ...testConfig(), CORS_ORIGINS: ['http://localhost:5173'] };
    const app = createApp({
      config,
      logger: testLogger(),
      health: { knex, redisClient: null },
      rateLimiter: buildRateLimiter(config.RATE_LIMIT_PER_MINUTE),
    });

    const res = await request(app)
      .options('/api/auth/refresh')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();

    await knex.destroy();
  });
});
