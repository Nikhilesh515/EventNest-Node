import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  getSharedTestApp,
  destroySharedTestApp,
  resetTestData,
  type TestAppContext,
} from '../../helpers/test-setup.js';
import type { Express } from 'express';

describe('Roles API', () => {
  let ctx: TestAppContext;
  let app: Express;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    ctx = await getSharedTestApp();
    app = ctx.app;

    // Get admin token
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@eventnest.io',
      password: 'Admin@123',
    });
    adminToken = adminLogin.body.result.accessToken;

    // Create a regular user and login
    await request(app).post('/api/auth/register').send({
      email: 'role-test-user@test.example.com',
      displayName: 'Role Test User',
      password: 'TestPass123!',
    });
    const userLogin = await request(app).post('/api/auth/login').send({
      email: 'role-test-user@test.example.com',
      password: 'TestPass123!',
    });
    userToken = userLogin.body.result.accessToken;
  });

  afterAll(async () => {
    await destroySharedTestApp();
  });

  beforeEach(async () => {
    await resetTestData(ctx.knex);
  });

  describe('GET /api/roles', () => {
    it('returns all roles for admin', async () => {
      const res = await request(app)
        .get('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.result).toBeInstanceOf(Array);
      expect(res.body.result.length).toBeGreaterThanOrEqual(5);

      const admin = res.body.result.find((r: { name: string }) => r.name === 'Admin');
      expect(admin).toBeDefined();
      expect(admin.permissionNames).toBeInstanceOf(Array);
      expect(admin.permissionNames.length).toBe(15);
      expect(admin.userCount).toBeGreaterThanOrEqual(1);
    });

    it('rejects unauthenticated request', async () => {
      const res = await request(app).get('/api/roles');
      expect(res.status).toBe(401);
    });

    it('rejects regular user', async () => {
      const res = await request(app)
        .get('/api/roles')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/roles/:id', () => {
    it('returns role by ID', async () => {
      const list = await request(app)
        .get('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`);
      const roleId = list.body.result[0]?.id;

      const res = await request(app)
        .get(`/api/roles/${roleId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.result.id).toBe(roleId);
      expect(res.body.result.permissionNames).toBeInstanceOf(Array);
    });

    it('returns 404 for unknown ID', async () => {
      const res = await request(app)
        .get('/api/roles/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/roles', () => {
    it('creates a new role', async () => {
      const res = await request(app)
        .post('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'TestRole',
          displayName: 'Test Role',
          description: 'A test role',
          permissionNames: ['Events.View', 'Tags.View'],
        });

      expect(res.status).toBe(200);
      expect(res.body.result.name).toBe('TestRole');
      expect(res.body.result.permissionNames).toEqual(['Events.View', 'Tags.View']);
    });

    it('rejects duplicate name', async () => {
      const res = await request(app)
        .post('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Admin',
          displayName: 'Admin',
          permissionNames: ['Events.View'],
        });
      expect(res.status).toBe(409);
    });

    it('rejects invalid permissions', async () => {
      const res = await request(app)
        .post('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'BadRole',
          displayName: 'Bad Role',
          permissionNames: ['Invalid.Perm'],
        });
      expect(res.status).toBe(400);
    });

    it('rejects regular user', async () => {
      const res = await request(app)
        .post('/api/roles')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'ShouldFail',
          displayName: 'Should Fail',
          permissionNames: ['Events.View'],
        });
      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/roles/:id', () => {
    it('updates role metadata', async () => {
      const create = await request(app)
        .post('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'ToUpdate',
          displayName: 'To Update',
          permissionNames: ['Events.View'],
        });
      const roleId = create.body.result.id;

      const res = await request(app)
        .put(`/api/roles/${roleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ displayName: 'Updated Role' });

      expect(res.status).toBe(200);
      expect(res.body.result.displayName).toBe('Updated Role');
    });

    it('updates role permissions', async () => {
      const create = await request(app)
        .post('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'PermUpdate',
          displayName: 'Perm Update',
          permissionNames: ['Events.View'],
        });
      const roleId = create.body.result.id;

      const res = await request(app)
        .put(`/api/roles/${roleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ permissionNames: ['Events.View', 'Events.Create', 'Tags.View'] });

      expect(res.status).toBe(200);
      expect(res.body.result.permissionNames).toContain('Events.Create');
    });
  });

  describe('DELETE /api/roles/:id', () => {
    it('deletes a custom role', async () => {
      const create = await request(app)
        .post('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'ToDelete',
          displayName: 'To Delete',
          permissionNames: ['Events.View'],
        });
      const roleId = create.body.result.id;

      const res = await request(app)
        .delete(`/api/roles/${roleId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });

    it('rejects deleting built-in role', async () => {
      const list = await request(app)
        .get('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`);
      const adminRole = list.body.result.find((r: { name: string }) => r.name === 'Admin');

      const res = await request(app)
        .delete(`/api/roles/${adminRole.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/users/:id/role', () => {
    it('assigns a role to a user', async () => {
      const reg = await request(app).post('/api/auth/register').send({
        email: 'roleassign@test.example.com',
        displayName: 'Role Assign',
        password: 'TestPass123!',
      });
      const userId = reg.body.result.user.id;

      const roles = await request(app)
        .get('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`);
      const organizerRole = roles.body.result.find((r: { name: string }) => r.name === 'Organizer');

      const res = await request(app)
        .put(`/api/users/${userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleId: organizerRole.id });
      expect(res.status).toBe(204);
    });
  });
});
