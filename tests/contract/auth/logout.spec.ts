import request from 'supertest';
import bcrypt from 'bcrypt';
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  getSharedTestApp,
  destroySharedTestApp,
  type TestAppContext,
} from '../../helpers/auth-global.js';

let ctx: TestAppContext;

beforeAll(async () => {
  ctx = await getSharedTestApp();
});

afterAll(async () => {
  await destroySharedTestApp();
});

beforeEach(async () => {
  await ctx.knex('refresh_tokens').del();
  await ctx.knex('permission_grants').del();
  await ctx.knex('users').where('email', 'like', '%@test.example.com').del();
});

async function registerUser(
  email: string,
  password: string,
  displayName: string,
): Promise<{ refreshToken: string }> {
  const res = await request(ctx.app).post('/api/auth/register').send({
    email,
    password,
    displayName,
  });
  return { refreshToken: res.body.result.refreshToken };
}

describe('POST /api/auth/logout', () => {
  it('returns 204 with valid token', async () => {
    const { refreshToken } = await registerUser(
      'logout-valid@test.example.com',
      'password123',
      'Logout User',
    );

    const res = await request(ctx.app).post('/api/auth/logout').send({
      refreshToken,
    });

    expect(res.status).toBe(204);
  });

  it('revokes the refresh token after logout', async () => {
    const { refreshToken } = await registerUser(
      'logout-revoke@test.example.com',
      'password123',
      'Revoke User',
    );

    await request(ctx.app).post('/api/auth/logout').send({ refreshToken });

    const refreshRes = await request(ctx.app).post('/api/auth/refresh').send({
      refreshToken,
    });

    expect(refreshRes.status).toBe(401);
  });

  it('returns 204 for unknown token (idempotent)', async () => {
    const res = await request(ctx.app).post('/api/auth/logout').send({
      refreshToken: 'totally-fake-token-value',
    });

    expect(res.status).toBe(204);
  });

  it('returns 204 for already revoked token (idempotent)', async () => {
    const { refreshToken } = await registerUser(
      'logout-idempotent@test.example.com',
      'password123',
      'Idempotent User',
    );

    await request(ctx.app).post('/api/auth/logout').send({ refreshToken });

    const res = await request(ctx.app).post('/api/auth/logout').send({
      refreshToken,
    });

    expect(res.status).toBe(204);
  });

  it('returns 400 with empty refreshToken', async () => {
    const res = await request(ctx.app).post('/api/auth/logout').send({
      refreshToken: '',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 with missing refreshToken', async () => {
    const res = await request(ctx.app).post('/api/auth/logout').send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
