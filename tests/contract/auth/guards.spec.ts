import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { requireAuth } from '../../../src/shared/http/middleware/require-auth.js';
import {
  requirePermission,
  setPermissionCache,
  setPermissionResolver,
} from '../../../src/shared/http/middleware/require-permission.js';
import { attachUserIfPresent } from '../../../src/shared/http/middleware/attach-user-if-present.js';
import { ok } from '../../../src/shared/http/respond.js';
import { errorHandler } from '../../../src/shared/http/middleware/error-handler.js';
import { ForbiddenError } from '../../../src/shared/domain/errors.js';
import { pino } from 'pino';
import { testConfig } from '../../helpers/app.js';
import type { CachePort } from '../../../src/shared/application/ports/cache-port.js';

const config = testConfig();
const logger = pino({ level: 'silent' });

type RequestWithUser = express.Request & { user?: unknown };

function createInMemoryCache(): CachePort {
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

function generateToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, config.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '60m',
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
  });
}

beforeAll(() => {
  process.env.JWT_SECRET = config.JWT_SECRET;
  process.env.JWT_ISSUER = config.JWT_ISSUER;
  process.env.JWT_AUDIENCE = config.JWT_AUDIENCE;
});

afterAll(() => {
  delete process.env.JWT_SECRET;
  delete process.env.JWT_ISSUER;
  delete process.env.JWT_AUDIENCE;
});

function buildGuardTestApp(middlewares: express.RequestHandler[]): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/api/guarded', ...middlewares, (req, res) => {
    ok(res, { user: (req as RequestWithUser).user });
  });

  app.use(errorHandler(logger));
  return app;
}

describe('requireAuth guard', () => {
  it('returns 401 when no token is provided', async () => {
    const app = buildGuardTestApp([requireAuth]);

    const res = await request(app).get('/api/guarded');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Authentication is required.');
  });

  it('returns 401 when Authorization header is malformed', async () => {
    const app = buildGuardTestApp([requireAuth]);

    const res = await request(app).get('/api/guarded').set('Authorization', 'InvalidHeader');

    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    const app = buildGuardTestApp([requireAuth]);

    const res = await request(app)
      .get('/api/guarded')
      .set('Authorization', 'Bearer invalid-token-value');

    expect(res.status).toBe(401);
  });

  it('proceeds with req.user when token is valid', async () => {
    const app = buildGuardTestApp([requireAuth]);

    const token = generateToken({
      sub: 'user-123',
      email: 'test@test.com',
      name: 'Test User',
      role: 'User',
      jti: 'jti-123',
    });

    const res = await request(app).get('/api/guarded').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.result.user).toEqual({
      id: 'user-123',
      email: 'test@test.com',
      name: 'Test User',
      role: 'User',
      jti: 'jti-123',
    });
  });

  it('returns 401 when token is expired', async () => {
    const app = buildGuardTestApp([requireAuth]);

    const token = jwt.sign(
      {
        sub: 'user-123',
        email: 'test@test.com',
        name: 'Test User',
        role: 'User',
        jti: 'jti-123',
      },
      config.JWT_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: '-10s',
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE,
      },
    );

    const res = await request(app).get('/api/guarded').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
  });
});

describe('requirePermission guard', () => {
  it('returns 401 when no user is attached (no token)', async () => {
    const cache = createInMemoryCache();
    setPermissionCache(cache);
    const app = buildGuardTestApp([requirePermission('Events.View')]);

    const res = await request(app).get('/api/guarded');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Authentication is required.');
  });

  it('returns 403 when user has no permissions in cache', async () => {
    const cache = createInMemoryCache();
    setPermissionCache(cache);
    const app = buildGuardTestApp([requireAuth, requirePermission('Events.View')]);

    const token = generateToken({
      sub: 'user-456',
      email: 'noperm@test.com',
      name: 'No Perm User',
      role: 'User',
      jti: 'jti-456',
    });

    const res = await request(app).get('/api/guarded').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('proceeds when user has the required permission', async () => {
    const cache = createInMemoryCache();
    await cache.set('user:user-789:permissions', ['Events.View', 'Tags.View'], 300);
    setPermissionCache(cache);
    const app = buildGuardTestApp([requireAuth, requirePermission('Events.View')]);

    const token = generateToken({
      sub: 'user-789',
      email: 'hasperm@test.com',
      name: 'Has Perm User',
      role: 'User',
      jti: 'jti-789',
    });

    const res = await request(app).get('/api/guarded').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.result.user).toBeDefined();
  });

  it('returns 403 when user does not have the required permission', async () => {
    const cache = createInMemoryCache();
    await cache.set('user:user-999:permissions', ['Tags.View'], 300);
    setPermissionCache(cache);
    const app = buildGuardTestApp([requireAuth, requirePermission('Events.View')]);

    const token = generateToken({
      sub: 'user-999',
      email: 'wrongperm@test.com',
      name: 'Wrong Perm User',
      role: 'User',
      jti: 'jti-999',
    });

    const res = await request(app).get('/api/guarded').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 when no permission cache is configured', async () => {
    setPermissionCache(null as unknown as CachePort);
    const app = buildGuardTestApp([requireAuth, requirePermission('Events.View')]);

    const token = generateToken({
      sub: 'user-nocache',
      email: 'nocache@test.com',
      name: 'No Cache User',
      role: 'User',
      jti: 'jti-nocache',
    });

    const res = await request(app).get('/api/guarded').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);

    setPermissionCache(createInMemoryCache());
  });

  it('resolves permissions and warms the cache on a cache miss', async () => {
    const cache = createInMemoryCache();
    setPermissionCache(cache);
    setPermissionResolver(async () => ['Events.View']);
    const app = buildGuardTestApp([requireAuth, requirePermission('Events.View')]);

    const token = generateToken({
      sub: 'user-miss',
      email: 'miss@test.com',
      name: 'Cache Miss User',
      role: 'User',
      jti: 'jti-miss',
    });

    const res = await request(app).get('/api/guarded').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(await cache.get<string[]>('user:user-miss:permissions')).toEqual(['Events.View']);
  });

  it('forwards domain errors thrown by the resolver', async () => {
    const cache = createInMemoryCache();
    setPermissionCache(cache);
    setPermissionResolver(async () => {
      throw new ForbiddenError('Permission denied.');
    });
    const app = buildGuardTestApp([requireAuth, requirePermission('Events.View')]);

    const token = generateToken({
      sub: 'user-throw-domain',
      email: 'throw-domain@test.com',
      name: 'Domain Throw User',
      role: 'User',
      jti: 'jti-throw-domain',
    });

    const res = await request(app).get('/api/guarded').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('maps unexpected resolver failures to 500', async () => {
    const cache = createInMemoryCache();
    setPermissionCache(cache);
    setPermissionResolver(async () => {
      throw new Error('boom');
    });
    const app = buildGuardTestApp([requireAuth, requirePermission('Events.View')]);

    const token = generateToken({
      sub: 'user-throw-unexpected',
      email: 'throw-unexpected@test.com',
      name: 'Unexpected Throw User',
      role: 'User',
      jti: 'jti-throw-unexpected',
    });

    const res = await request(app).get('/api/guarded').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Permission check failed.');
  });
});

describe('attachUserIfPresent middleware', () => {
  it('proceeds without req.user when no token is provided', async () => {
    const app = express();
    app.disable('x-powered-by');
    app.use(express.json());

    app.get('/api/guarded', attachUserIfPresent, (req, res) => {
      ok(res, { user: (req as RequestWithUser).user ?? null });
    });

    app.use(errorHandler(logger));

    const res = await request(app).get('/api/guarded');

    expect(res.status).toBe(200);
    expect(res.body.result.user).toBeNull();
  });

  it('attaches user when valid token is provided', async () => {
    const app = express();
    app.disable('x-powered-by');
    app.use(express.json());

    app.get('/api/guarded', attachUserIfPresent, (req, res) => {
      ok(res, { user: (req as RequestWithUser).user ?? null });
    });

    app.use(errorHandler(logger));

    const token = generateToken({
      sub: 'user-abc',
      email: 'attach@test.com',
      name: 'Attach User',
      role: 'User',
      jti: 'jti-abc',
    });

    const res = await request(app).get('/api/guarded').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.result.user).toEqual({
      id: 'user-abc',
      email: 'attach@test.com',
      name: 'Attach User',
      role: 'User',
      jti: 'jti-abc',
    });
  });

  it('proceeds without req.user when token is invalid', async () => {
    const app = express();
    app.disable('x-powered-by');
    app.use(express.json());

    app.get('/api/guarded', attachUserIfPresent, (req, res) => {
      ok(res, { user: (req as RequestWithUser).user ?? null });
    });

    app.use(errorHandler(logger));

    const res = await request(app).get('/api/guarded').set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(200);
    expect(res.body.result.user).toBeNull();
  });

  it('does not return 401 for invalid tokens (unlike requireAuth)', async () => {
    const app = express();
    app.disable('x-powered-by');
    app.use(express.json());

    app.get('/api/guarded', attachUserIfPresent, (req, res) => {
      ok(res, { user: (req as RequestWithUser).user ?? null });
    });

    app.use(errorHandler(logger));

    const res = await request(app)
      .get('/api/guarded')
      .set('Authorization', 'Bearer totally-invalid');

    expect(res.status).toBe(200);
  });

  it('proceeds without req.user when the bearer token is empty', async () => {
    const app = express();
    app.disable('x-powered-by');
    app.use(express.json());

    app.get('/api/guarded', attachUserIfPresent, (req, res) => {
      ok(res, { user: (req as RequestWithUser).user ?? null });
    });

    app.use(errorHandler(logger));

    const res = await request(app).get('/api/guarded').set('Authorization', 'Bearer ');

    expect(res.status).toBe(200);
    expect(res.body.result.user).toBeNull();
  });
});
