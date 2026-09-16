import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  getSharedTestApp,
  destroySharedTestApp,
  resetTestData,
  type TestAppContext,
} from '../../helpers/test-setup.js';
import { registerUser, setCookieHeaders, REFRESH_COOKIE } from '../../helpers/auth-helpers.js';

let ctx: TestAppContext;

beforeAll(async () => {
  ctx = await getSharedTestApp();
});

afterAll(async () => {
  await destroySharedTestApp();
});

beforeEach(async () => {
  await resetTestData(ctx.knex);
});

function clearedCookie(res: request.Response): string | undefined {
  return setCookieHeaders(res).find((c) => c.startsWith(`${REFRESH_COOKIE}=;`));
}

describe('POST /api/auth/logout', () => {
  it('returns 204 with a valid cookie and clears it', async () => {
    const session = await registerUser(
      ctx.app,
      'logout-valid@test.example.com',
      'password123',
      'Logout User',
    );

    const res = await request(ctx.app).post('/api/auth/logout').set('Cookie', session.cookie);

    expect(res.status).toBe(204);
    expect(clearedCookie(res)).toBeDefined();
  });

  it('revokes the refresh token after logout', async () => {
    const session = await registerUser(
      ctx.app,
      'logout-revoke@test.example.com',
      'password123',
      'Revoke User',
    );

    await request(ctx.app).post('/api/auth/logout').set('Cookie', session.cookie);

    const refreshRes = await request(ctx.app)
      .post('/api/auth/refresh')
      .set('Cookie', session.cookie);

    expect(refreshRes.status).toBe(401);
  });

  it('returns 204 with an unknown token (idempotent)', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/logout')
      .set('Cookie', `${REFRESH_COOKIE}=totally-fake-token-value`);

    expect(res.status).toBe(204);
    expect(clearedCookie(res)).toBeDefined();
  });

  it('returns 204 with an already revoked token (idempotent)', async () => {
    const session = await registerUser(
      ctx.app,
      'logout-idempotent@test.example.com',
      'password123',
      'Idempotent User',
    );

    await request(ctx.app).post('/api/auth/logout').set('Cookie', session.cookie);

    const res = await request(ctx.app).post('/api/auth/logout').set('Cookie', session.cookie);

    expect(res.status).toBe(204);
    expect(clearedCookie(res)).toBeDefined();
  });

  it('returns 204 with no cookie', async () => {
    const res = await request(ctx.app).post('/api/auth/logout');

    expect(res.status).toBe(204);
    expect(clearedCookie(res)).toBeDefined();
  });
});
