import request from 'supertest';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
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

async function createTestUser(
  email: string,
  password: string,
  displayName: string,
): Promise<{ id: string }> {
  const role = await ctx.knex('roles').where('name', 'User').first();
  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await ctx
    .knex('users')
    .insert({
      id: crypto.randomUUID(),
      email,
      display_name: displayName,
      password_hash: passwordHash,
      role_id: role!.id,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning('id');
  return user;
}

async function registerUser(
  email: string,
  password: string,
  displayName: string,
): Promise<{ refreshToken: string; accessToken: string }> {
  const res = await request(ctx.app).post('/api/auth/register').send({
    email,
    password,
    displayName,
  });
  return {
    refreshToken: res.body.result.refreshToken,
    accessToken: res.body.result.accessToken,
  };
}

describe('POST /api/auth/refresh', () => {
  it('returns 200 with new token pair on valid token', async () => {
    const tokens = await registerUser(
      'refresh-valid@test.example.com',
      'password123',
      'Refresh User',
    );

    const res = await request(ctx.app).post('/api/auth/refresh').send({
      refreshToken: tokens.refreshToken,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.result).toEqual(
      expect.objectContaining({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: 3600,
      }),
    );
    expect(res.body.result.refreshToken).not.toBe(tokens.refreshToken);
  });

  it('returns 401 with expired token', async () => {
    const user = await createTestUser(
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
    });

    const res = await request(ctx.app).post('/api/auth/refresh').send({
      refreshToken: token,
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid or expired refresh token.');
  });

  it('returns 401 with revoked token', async () => {
    const tokens = await registerUser(
      'refresh-revoked@test.example.com',
      'password123',
      'Revoked User',
    );

    await request(ctx.app).post('/api/auth/logout').send({
      refreshToken: tokens.refreshToken,
    });

    const res = await request(ctx.app).post('/api/auth/refresh').send({
      refreshToken: tokens.refreshToken,
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid or expired refresh token.');
  });

  it('returns 401 with completely unknown token', async () => {
    const res = await request(ctx.app).post('/api/auth/refresh').send({
      refreshToken: 'completely-unknown-token-value',
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid or expired refresh token.');
  });

  it('returns 400 with empty refreshToken', async () => {
    const res = await request(ctx.app).post('/api/auth/refresh').send({
      refreshToken: '',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('invalidates the old refresh token after rotation', async () => {
    const tokens = await registerUser(
      'refresh-invalidate@test.example.com',
      'password123',
      'Invalidate User',
    );

    await request(ctx.app).post('/api/auth/refresh').send({
      refreshToken: tokens.refreshToken,
    });

    const res = await request(ctx.app).post('/api/auth/refresh').send({
      refreshToken: tokens.refreshToken,
    });

    expect(res.status).toBe(401);
  });
});
