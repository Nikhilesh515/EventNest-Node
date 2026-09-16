import request from 'supertest';
import crypto from 'node:crypto';
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  getSharedTestApp,
  buildTestApp,
  destroyTestApp,
  destroySharedTestApp,
  resetTestData,
  testConfig,
  type TestAppContext,
} from '../../helpers/test-setup.js';
import {
  createTestUser,
  registerUser,
  loginUser,
  refreshCookie,
  setCookieHeaders,
  REFRESH_COOKIE,
} from '../../helpers/auth-helpers.js';

let ctx: TestAppContext;
let graceCtx: TestAppContext;

beforeAll(async () => {
  ctx = await getSharedTestApp();
  graceCtx = await buildTestApp(testConfig({ REFRESH_ROTATION_GRACE_SECONDS: '30' }));
});

afterAll(async () => {
  await destroyTestApp(graceCtx);
  await destroySharedTestApp();
});

beforeEach(async () => {
  await resetTestData(ctx.knex);
});

function clearedCookie(res: request.Response): string | undefined {
  return setCookieHeaders(res).find((c) => c.startsWith(`${REFRESH_COOKIE}=;`));
}

function cookieHash(cookie: string): string {
  const raw = cookie.split('=').slice(1).join('=');
  return crypto.createHash('sha256').update(raw).digest('hex');
}

describe('POST /api/auth/refresh', () => {
  it('returns 200 with a new token pair on a valid cookie', async () => {
    const session = await registerUser(
      ctx.app,
      'refresh-valid@test.example.com',
      'password123',
      'Refresh User',
    );

    const res = await request(ctx.app).post('/api/auth/refresh').set('Cookie', session.cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.result).toEqual(
      expect.objectContaining({
        accessToken: expect.any(String),
        expiresIn: 3600,
        user: expect.objectContaining({ email: 'refresh-valid@test.example.com' }),
      }),
    );
    expect(res.body.result.refreshToken).toBeUndefined();

    const rotated = refreshCookie(res);
    const rotatedRaw = setCookieHeaders(res).find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
    expect(rotated).not.toBe(session.cookie);
    expect(rotatedRaw).toContain('HttpOnly');
    expect(rotatedRaw).toContain('SameSite=Lax');
    expect(rotatedRaw).toContain('Path=/api/auth');
  });

  it('returns 401 with no cookie and clears the cookie', async () => {
    const res = await request(ctx.app).post('/api/auth/refresh');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid refresh token.');
    expect(clearedCookie(res)).toBeDefined();
  });

  it('returns 401 with an unknown cookie and clears the cookie', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=completely-unknown-token-value`);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid refresh token.');
    expect(clearedCookie(res)).toBeDefined();
  });

  it('returns 401 with an expired token', async () => {
    const user = await createTestUser(
      ctx.knex,
      'refresh-expired@test.example.com',
      'password123',
      'Expired User',
    );

    const token = crypto.randomBytes(64).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await ctx.knex('refresh_tokens').insert({
      id: crypto.randomUUID(),
      token_hash: tokenHash,
      user_id: user.id,
      expires_at: new Date(Date.now() - 1000),
      created_by_ip: '127.0.0.1',
      created_at: new Date(),
    });

    const res = await request(ctx.app)
      .post('/api/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${token}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid refresh token.');
    expect(clearedCookie(res)).toBeDefined();
  });

  it('returns 401 with a logout-revoked token and clears the cookie', async () => {
    const session = await registerUser(
      ctx.app,
      'refresh-revoked@test.example.com',
      'password123',
      'Revoked User',
    );

    await request(ctx.app).post('/api/auth/logout').set('Cookie', session.cookie);

    const res = await request(ctx.app).post('/api/auth/refresh').set('Cookie', session.cookie);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid refresh token.');
    expect(clearedCookie(res)).toBeDefined();
  });

  it('invalidates the old cookie after rotation', async () => {
    const session = await registerUser(
      ctx.app,
      'refresh-invalidate@test.example.com',
      'password123',
      'Invalidate User',
    );

    await request(ctx.app).post('/api/auth/refresh').set('Cookie', session.cookie);

    const res = await request(ctx.app).post('/api/auth/refresh').set('Cookie', session.cookie);

    expect(res.status).toBe(401);
    expect(clearedCookie(res)).toBeDefined();
  });

  it('records the replacement hash when rotating', async () => {
    const session = await registerUser(
      ctx.app,
      'refresh-record@test.example.com',
      'password123',
      'Record User',
    );

    const res = await request(ctx.app).post('/api/auth/refresh').set('Cookie', session.cookie);
    expect(res.status).toBe(200);

    const row = await ctx
      .knex('refresh_tokens')
      .where('token_hash', cookieHash(session.cookie))
      .first();
    expect(row.revoked_at).not.toBeNull();
    expect(row.replaced_by_token_hash).toEqual(expect.any(String));

    const active = await ctx
      .knex('refresh_tokens')
      .where('user_id', session.userId)
      .whereNull('revoked_at');
    expect(active).toHaveLength(1);
  });
});

describe('POST /api/auth/refresh — origin enforcement', () => {
  it('rejects a disallowed origin with 403', async () => {
    const session = await registerUser(
      ctx.app,
      'refresh-origin-bad@test.example.com',
      'password123',
      'Origin User',
    );

    const res = await request(ctx.app)
      .post('/api/auth/refresh')
      .set('Cookie', session.cookie)
      .set('Origin', 'https://evil.example');

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Request origin is not allowed.');
  });

  it('allows an allowlisted origin', async () => {
    const session = await registerUser(
      ctx.app,
      'refresh-origin-good@test.example.com',
      'password123',
      'Origin User',
    );

    const res = await request(ctx.app)
      .post('/api/auth/refresh')
      .set('Cookie', session.cookie)
      .set('Origin', 'http://localhost:5173');

    expect(res.status).toBe(200);
  });

  it('rejects a disallowed origin on logout with 403', async () => {
    const session = await registerUser(
      ctx.app,
      'logout-origin-bad@test.example.com',
      'password123',
      'Origin User',
    );

    const res = await request(ctx.app)
      .post('/api/auth/logout')
      .set('Cookie', session.cookie)
      .set('Origin', 'https://evil.example');

    expect(res.status).toBe(403);
  });
});

describe('POST /api/auth/refresh — rotation grace (REFRESH_ROTATION_GRACE_SECONDS=30)', () => {
  it('re-exchanges a recently rotated cookie without mutating the old row', async () => {
    const session = await registerUser(
      graceCtx.app,
      'refresh-grace@test.example.com',
      'password123',
      'Grace User',
    );

    const first = await request(graceCtx.app)
      .post('/api/auth/refresh')
      .set('Cookie', session.cookie);
    expect(first.status).toBe(200);

    const rowAfterFirst = await graceCtx
      .knex('refresh_tokens')
      .where('token_hash', cookieHash(session.cookie))
      .first();
    expect(rowAfterFirst.revoked_at).not.toBeNull();

    const second = await request(graceCtx.app)
      .post('/api/auth/refresh')
      .set('Cookie', session.cookie);
    expect(second.status).toBe(200);
    expect(refreshCookie(second)).not.toBe(refreshCookie(first));

    const rowAfterSecond = await graceCtx
      .knex('refresh_tokens')
      .where('token_hash', cookieHash(session.cookie))
      .first();
    expect(rowAfterSecond.revoked_at).toEqual(rowAfterFirst.revoked_at);
    expect(rowAfterSecond.replaced_by_token_hash).toBe(rowAfterFirst.replaced_by_token_hash);
  });
});

describe('POST /api/auth/refresh — reuse detection (REFRESH_ROTATION_GRACE_SECONDS=0)', () => {
  it('revokes every active token for the user when a rotated cookie is replayed', async () => {
    const session = await registerUser(
      ctx.app,
      'refresh-reuse@test.example.com',
      'password123',
      'Reuse User',
    );
    const otherSession = await loginUser(ctx.app, 'refresh-reuse@test.example.com', 'password123');

    const rotated = await request(ctx.app).post('/api/auth/refresh').set('Cookie', session.cookie);
    expect(rotated.status).toBe(200);

    const replay = await request(ctx.app).post('/api/auth/refresh').set('Cookie', session.cookie);

    expect(replay.status).toBe(401);
    expect(clearedCookie(replay)).toBeDefined();

    const active = await ctx
      .knex('refresh_tokens')
      .where('user_id', session.userId)
      .whereNull('revoked_at');
    expect(active).toHaveLength(0);

    const otherAfter = await request(ctx.app)
      .post('/api/auth/refresh')
      .set('Cookie', otherSession.cookie);
    expect(otherAfter.status).toBe(401);
  });

  it('keeps other sessions alive after logout', async () => {
    const session = await registerUser(
      ctx.app,
      'refresh-logout-scope@test.example.com',
      'password123',
      'Scope User',
    );
    const otherSession = await loginUser(
      ctx.app,
      'refresh-logout-scope@test.example.com',
      'password123',
    );

    await request(ctx.app).post('/api/auth/logout').set('Cookie', session.cookie);

    const revoked = await request(ctx.app).post('/api/auth/refresh').set('Cookie', session.cookie);
    expect(revoked.status).toBe(401);

    const alive = await request(ctx.app)
      .post('/api/auth/refresh')
      .set('Cookie', otherSession.cookie);
    expect(alive.status).toBe(200);
  });
});
