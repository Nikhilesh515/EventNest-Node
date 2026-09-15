import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  getSharedTestApp,
  destroySharedTestApp,
  resetTestData,
  type TestAppContext,
} from '../../helpers/test-setup.js';
import { registerUser } from '../../helpers/auth-helpers.js';

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

describe('POST /api/auth/logout', () => {
  it('returns 204 with valid token', async () => {
    const { refreshToken } = await registerUser(
      ctx.app,
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
      ctx.app,
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
      ctx.app,
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
