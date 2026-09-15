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

async function createTestUser(
  email: string,
  password: string,
  displayName: string,
  isActive = true,
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
      is_active: isActive,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning('id');
  return user;
}

describe('POST /api/auth/login', () => {
  it('returns 200 with valid credentials', async () => {
    await createTestUser('login-valid@test.example.com', 'password123', 'Valid User');

    const res = await request(ctx.app).post('/api/auth/login').send({
      email: 'login-valid@test.example.com',
      password: 'password123',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.result).toEqual(
      expect.objectContaining({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: 3600,
        user: expect.objectContaining({
          email: 'login-valid@test.example.com',
          displayName: 'Valid User',
          roleName: 'User',
          isActive: true,
        }),
      }),
    );
  });

  it('returns 401 with unknown email', async () => {
    const res = await request(ctx.app).post('/api/auth/login').send({
      email: 'unknown@test.example.com',
      password: 'password123',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid email or password.');
  });

  it('returns 401 with wrong password', async () => {
    await createTestUser('login-wrong@test.example.com', 'password123', 'Wrong User');

    const res = await request(ctx.app).post('/api/auth/login').send({
      email: 'login-wrong@test.example.com',
      password: 'wrongpassword',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid email or password.');
  });

  it('returns 401 with deactivated user', async () => {
    await createTestUser('login-inactive@test.example.com', 'password123', 'Inactive User', false);

    const res = await request(ctx.app).post('/api/auth/login').send({
      email: 'login-inactive@test.example.com',
      password: 'password123',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Account has been deactivated.');
  });

  it('returns 400 with invalid email format', async () => {
    const res = await request(ctx.app).post('/api/auth/login').send({
      email: 'not-an-email',
      password: 'password123',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 with missing password', async () => {
    const res = await request(ctx.app).post('/api/auth/login').send({
      email: 'test@test.example.com',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('response contains valid JWT access token', async () => {
    await createTestUser('login-jwt@test.example.com', 'password123', 'JWT User');

    const res = await request(ctx.app).post('/api/auth/login').send({
      email: 'login-jwt@test.example.com',
      password: 'password123',
    });

    const token = res.body.result.accessToken;
    const parts = token.split('.');
    expect(parts).toHaveLength(3);

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    expect(payload).toHaveProperty('sub');
    expect(payload).toHaveProperty('email', 'login-jwt@test.example.com');
    expect(payload).toHaveProperty('role', 'User');
  });
});
