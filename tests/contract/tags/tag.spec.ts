import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  getSharedTestApp,
  destroySharedTestApp,
  resetTestData,
  type TestAppContext,
} from '../../helpers/test-setup.js';
import { registerUser, loginUser } from '../../helpers/auth-helpers.js';

let ctx: TestAppContext;
let adminToken: string;
let userToken: string;

beforeAll(async () => {
  ctx = await getSharedTestApp();
  const admin = await loginUser(ctx.app, 'admin@eventnest.io', 'Admin@123');
  adminToken = admin.accessToken;
  const user = await registerUser(ctx.app, 'taguser@test.example.com', 'password123', 'Tag User');
  userToken = user.accessToken;
});

afterAll(async () => {
  await destroySharedTestApp();
});

beforeEach(async () => {
  await resetTestData(ctx.knex);
});

describe('GET /api/tags', () => {
  it('TC-TAG-001: returns all seeded tags', async () => {
    const res = await request(ctx.app).get('/api/tags');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.result)).toBe(true);
    expect(res.body.result.length).toBeGreaterThanOrEqual(5);

    const names = res.body.result.map((t: { name: string }) => t.name);
    expect(names).toContain('Technology');
    expect(names).toContain('Music');
  });
});

describe('GET /api/tags/:id', () => {
  it('TC-TAG-002: returns single tag by ID', async () => {
    const listRes = await request(ctx.app).get('/api/tags');
    const tagId = listRes.body.result[0].id;

    const res = await request(ctx.app).get(`/api/tags/${tagId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.result.id).toBe(tagId);
    expect(res.body.result).toHaveProperty('name');
    expect(res.body.result).toHaveProperty('color');
    expect(res.body.result).toHaveProperty('createdAt');
  });

  it('TC-TAG-003: returns 404 for unknown ID', async () => {
    const res = await request(ctx.app).get('/api/tags/00000000-0000-0000-0000-000000000000');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/tags', () => {
  it('TC-TAG-004: creates tag with admin token', async () => {
    const res = await request(ctx.app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New Tag', color: '#abc123' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.result.name).toBe('New Tag');
    expect(res.body.result.color).toBe('#abc123');
    expect(res.headers.location).toContain('/api/tags/');
  });

  it('TC-TAG-005: returns 409 for duplicate name', async () => {
    await request(ctx.app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Duplicate', color: '#000000' });

    const res = await request(ctx.app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Duplicate', color: '#111111' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors.name).toBeDefined();
  });

  it('TC-TAG-006: returns 400 for invalid color', async () => {
    const res = await request(ctx.app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bad Color', color: 'red' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('TC-TAG-007: returns 401 without auth', async () => {
    const res = await request(ctx.app)
      .post('/api/tags')
      .send({ name: 'No Auth', color: '#000000' });

    expect(res.status).toBe(401);
  });

  it('TC-TAG-008: returns 403 without permission', async () => {
    const res = await request(ctx.app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'User Tag', color: '#000000' });

    expect(res.status).toBe(403);
  });
});

describe('PUT /api/tags/:id', () => {
  it('TC-TAG-009: updates tag', async () => {
    const createRes = await request(ctx.app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'ToUpdate', color: '#000000' });
    const tagId = createRes.body.result.id;

    const res = await request(ctx.app)
      .put(`/api/tags/${tagId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated', color: '#ffffff' });

    expect(res.status).toBe(200);
    expect(res.body.result.name).toBe('Updated');
    expect(res.body.result.color).toBe('#ffffff');
  });

  it('TC-TAG-010: returns 404 for unknown ID', async () => {
    const res = await request(ctx.app)
      .put('/api/tags/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'X', color: '#000000' });

    expect(res.status).toBe(404);
  });

  it('TC-TAG-011: returns 409 for duplicate name (excluding self)', async () => {
    const createA = await request(ctx.app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'TagA', color: '#000000' });
    const tagAId = createA.body.result.id;

    await request(ctx.app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'TagB', color: '#111111' });

    const res = await request(ctx.app)
      .put(`/api/tags/${tagAId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'TagB', color: '#000000' });

    expect(res.status).toBe(409);
    expect(res.body.errors.name).toBeDefined();
  });
});

describe('DELETE /api/tags/:id', () => {
  it('TC-TAG-012: deletes tag', async () => {
    const createRes = await request(ctx.app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'ToDelete', color: '#000000' });
    const tagId = createRes.body.result.id;

    const delRes = await request(ctx.app)
      .delete(`/api/tags/${tagId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(delRes.status).toBe(204);

    const getRes = await request(ctx.app).get(`/api/tags/${tagId}`);
    expect(getRes.status).toBe(404);
  });

  it('TC-TAG-013: returns 404 for unknown ID', async () => {
    const res = await request(ctx.app)
      .delete('/api/tags/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});
