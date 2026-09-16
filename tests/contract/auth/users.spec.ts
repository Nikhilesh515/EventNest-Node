import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  getSharedTestApp,
  destroySharedTestApp,
  resetTestData,
  type TestAppContext,
} from '../../helpers/test-setup.js';
import type { Express } from 'express';

describe('Users API', () => {
  let ctx: TestAppContext;
  let app: Express;
  let adminToken: string;
  let userToken: string;
  let userRoleId: string;
  let adminRoleId: string;

  beforeAll(async () => {
    ctx = await getSharedTestApp();
    app = ctx.app;

    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@eventnest.io',
      password: 'Admin@123',
    });
    adminToken = adminLogin.body.result.accessToken;

    await request(app).post('/api/auth/register').send({
      email: 'userlist-test@test.example.com',
      displayName: 'UserList Test',
      password: 'TestPass123!',
    });
    const userLogin = await request(app).post('/api/auth/login').send({
      email: 'userlist-test@test.example.com',
      password: 'TestPass123!',
    });
    userToken = userLogin.body.result.accessToken;

    const roles = await request(app)
      .get('/api/roles')
      .set('Authorization', `Bearer ${adminToken}`);
    const userRole = roles.body.result.find((r: { name: string }) => r.name === 'User');
    const adminRole = roles.body.result.find((r: { name: string }) => r.name === 'Admin');
    userRoleId = userRole.id;
    adminRoleId = adminRole.id;
  });

  afterAll(async () => {
    await destroySharedTestApp();
  });

  beforeEach(async () => {
    await resetTestData(ctx.knex);
  });

  describe('GET /api/users (paginated)', () => {
    it('returns paginated results with default params', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.result).toHaveProperty('items');
      expect(res.body.result).toHaveProperty('total');
      expect(res.body.result).toHaveProperty('page', 1);
      expect(res.body.result).toHaveProperty('pageSize', 20);
      expect(res.body.result).toHaveProperty('pages');
      expect(Array.isArray(res.body.result.items)).toBe(true);
      expect(res.body.result.items.length).toBeGreaterThanOrEqual(1);
    });

    it('returns roleId in each item', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const firstUser = res.body.result.items[0];
      expect(firstUser).toHaveProperty('roleId');
      expect(firstUser).toHaveProperty('roleName');
      expect(typeof firstUser.roleId).toBe('string');
    });

    it('paginates correctly', async () => {
      const res = await request(app)
        .get('/api/users?page=1&pageSize=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.result.items.length).toBeLessThanOrEqual(2);
      expect(res.body.result.page).toBe(1);
      expect(res.body.result.pageSize).toBe(2);
    });

    it('filters by search term', async () => {
      await request(app).post('/api/auth/register').send({
        email: 'searchable-user@test.example.com',
        displayName: 'Searchable User',
        password: 'TestPass123!',
      });

      const res = await request(app)
        .get('/api/users?search=searchable-user')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.result.items.length).toBeGreaterThanOrEqual(1);
      res.body.result.items.forEach((u: { email: string; displayName: string }) => {
        const matches =
          u.email.toLowerCase().includes('searchable-user') ||
          u.displayName.toLowerCase().includes('searchable-user');
        expect(matches).toBe(true);
      });
    });

    it('filters by role UUID', async () => {
      const res = await request(app)
        .get(`/api/users?role=${adminRoleId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      res.body.result.items.forEach((u: { roleId: string }) => {
        expect(u.roleId).toBe(adminRoleId);
      });
    });

    it('rejects unauthenticated request', async () => {
      const res = await request(app).get('/api/users');
      expect(res.status).toBe(401);
    });

    it('rejects regular user', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/users', () => {
    it('creates a user with valid data', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'newadmin@test.example.com',
          displayName: 'New Admin User',
          password: 'password123',
          roleId: userRoleId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.result).toHaveProperty('id');
      expect(res.body.result.email).toBe('newadmin@test.example.com');
      expect(res.body.result.displayName).toBe('New Admin User');
      expect(res.body.result.roleName).toBe('User');
    });

    it('rejects duplicate email', async () => {
      await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'dup@test.example.com',
          displayName: 'First User',
          password: 'password123',
          roleId: userRoleId,
        });

      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'dup@test.example.com',
          displayName: 'Dup User',
          password: 'password123',
          roleId: userRoleId,
        });

      expect(res.status).toBe(409);
    });

    it('rejects short password', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'short@test.example.com',
          displayName: 'Short',
          password: '123',
          roleId: userRoleId,
        });

      expect(res.status).toBe(400);
    });

    it('rejects invalid roleId', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'badrole@test.example.com',
          displayName: 'Bad Role',
          password: 'password123',
          roleId: '00000000-0000-0000-0000-000000000000',
        });

      expect(res.status).toBe(404);
    });

    it('rejects regular user', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          email: 'shouldfail@test.example.com',
          displayName: 'Should Fail',
          password: 'password123',
          roleId: userRoleId,
        });

      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated request', async () => {
      const res = await request(app).post('/api/users').send({
        email: 'unauth@test.example.com',
        displayName: 'Unauth',
        password: 'password123',
        roleId: userRoleId,
      });

      expect(res.status).toBe(401);
    });
  });
});
