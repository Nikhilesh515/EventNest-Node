import request from 'supertest';
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

describe('POST /api/auth/register', () => {
  it('returns 200 with AuthResponseDto on valid input', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .send({
        email: 'register-success@test.example.com',
        password: 'password123',
        displayName: 'Test User',
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      code: 200,
      success: true,
      message: null,
      errors: null,
      result: expect.objectContaining({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: 3600,
        user: expect.objectContaining({
          id: expect.any(String),
          email: 'register-success@test.example.com',
          displayName: 'Test User',
          roleName: 'User',
          isActive: true,
        }),
      }),
    });
  });

  it('returns 409 with duplicate email', async () => {
    await request(ctx.app).post('/api/auth/register').send({
      email: 'duplicate@test.example.com',
      password: 'password123',
      displayName: 'First User',
    });

    const res = await request(ctx.app).post('/api/auth/register').send({
      email: 'duplicate@test.example.com',
      password: 'password123',
      displayName: 'Second User',
    });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('already exists');
  });

  it('returns 400 with short password', async () => {
    const res = await request(ctx.app).post('/api/auth/register').send({
      email: 'short@test.example.com',
      password: '123',
      displayName: 'Test User',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 with invalid email', async () => {
    const res = await request(ctx.app).post('/api/auth/register').send({
      email: 'not-an-email',
      password: 'password123',
      displayName: 'Test User',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 with missing displayName', async () => {
    const res = await request(ctx.app).post('/api/auth/register').send({
      email: 'nodisplay@test.example.com',
      password: 'password123',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('response has correct shape with all required fields', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .send({
        email: 'shape@test.example.com',
        password: 'password123',
        displayName: 'Shape Test',
      });

    expect(res.status).toBe(200);

    const result = res.body.result;
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(result).toHaveProperty('expiresIn');
    expect(result).toHaveProperty('user');

    expect(result.user).toHaveProperty('id');
    expect(result.user).toHaveProperty('email');
    expect(result.user).toHaveProperty('displayName');
    expect(result.user).toHaveProperty('roleName');
    expect(result.user).toHaveProperty('isActive');

    expect(typeof result.accessToken).toBe('string');
    expect(result.accessToken.length).toBeGreaterThan(0);
    expect(typeof result.refreshToken).toBe('string');
    expect(result.refreshToken.length).toBeGreaterThan(0);
    expect(typeof result.expiresIn).toBe('number');
  });

  it('returns a valid JWT access token', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .send({
        email: 'jwt@test.example.com',
        password: 'password123',
        displayName: 'JWT Test',
      });

    const token = res.body.result.accessToken;
    const parts = token.split('.');
    expect(parts).toHaveLength(3);

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    expect(payload).toHaveProperty('sub');
    expect(payload).toHaveProperty('email', 'jwt@test.example.com');
    expect(payload).toHaveProperty('role', 'User');
  });
});
