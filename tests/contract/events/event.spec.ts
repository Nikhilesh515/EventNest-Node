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
let organizerRoleId: string;

beforeAll(async () => {
  ctx = await getSharedTestApp();
  const admin = await loginUser(ctx.app, 'admin@eventnest.io', 'Admin@123');
  adminToken = admin.accessToken;
  const user = await registerUser(
    ctx.app,
    'eventuser@test.example.com',
    'password123',
    'Event User',
  );
  userToken = user.accessToken;
  const roles = await request(ctx.app)
    .get('/api/roles')
    .set('Authorization', `Bearer ${adminToken}`);
  organizerRoleId = roles.body.result.find((r: { name: string }) => r.name === 'Organizer').id;
});

afterAll(async () => {
  await destroySharedTestApp();
});

beforeEach(async () => {
  await resetTestData(ctx.knex);
});

const validEvent = {
  title: 'Test Event',
  description: 'A test event',
  location: 'Test Location',
  startsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  endsAt: new Date(Date.now() + 30 * 86_400_000 + 3 * 3_600_000).toISOString(),
  capacity: 100,
  tagIds: [] as string[],
};

describe('POST /api/events', () => {
  it('TC-EVT-001: creates event as Draft', async () => {
    const res = await request(ctx.app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validEvent);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.result.title).toBe('Test Event');
    expect(res.body.result.status).toBe('Draft');
    expect(res.body.result.visibility).toBe('Public');
    expect(res.body.result.organizerId).toBeDefined();
    expect(res.headers.location).toContain('/api/events/');
  });

  it('TC-EVT-002: returns 409 for duplicate title', async () => {
    await request(ctx.app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validEvent);

    const res = await request(ctx.app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validEvent);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toBeDefined();
  });

  it('TC-EVT-003: returns 400 for unknown tagId', async () => {
    const res = await request(ctx.app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validEvent, tagIds: ['00000000-0000-0000-0000-000000000000'] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toBeDefined();
  });

  it('TC-EVT-004: returns 401 without auth', async () => {
    const res = await request(ctx.app).post('/api/events').send(validEvent);

    expect(res.status).toBe(401);
  });

  it('TC-EVT-005: returns 403 without permission', async () => {
    const res = await request(ctx.app)
      .post('/api/events')
      .set('Authorization', `Bearer ${userToken}`)
      .send(validEvent);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/events', () => {
  it('TC-EVT-006: returns paginated events', async () => {
    const res = await request(ctx.app).get('/api/events');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.result.items)).toBe(true);
    expect(typeof res.body.result.total).toBe('number');
    expect(res.body.result.page).toBe(1);
    expect(res.body.result.size).toBe(10);
    expect(typeof res.body.result.pages).toBe('number');
  });

  it('TC-EVT-007: search filter works', async () => {
    const createRes = await request(ctx.app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validEvent, title: 'Tech Conference 2026' });

    await request(ctx.app)
      .put(`/api/events/${createRes.body.result.id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(ctx.app).get('/api/events?search=Tech');

    expect(res.status).toBe(200);
    const titles = res.body.result.items.map((e: { title: string }) => e.title);
    expect(titles.some((t: string) => t.includes('Tech'))).toBe(true);
  });

  it('TC-EVT-008: tagId filter works', async () => {
    const tagsRes = await request(ctx.app).get('/api/tags');
    const tagId = tagsRes.body.result[0]?.id;
    if (!tagId) return;

    const createRes = await request(ctx.app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validEvent, tagIds: [tagId] });

    await request(ctx.app)
      .put(`/api/events/${createRes.body.result.id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(ctx.app).get(`/api/events?tagId=${tagId}`);

    expect(res.status).toBe(200);
    expect(res.body.result.items.length).toBeGreaterThanOrEqual(1);
  });

  it('TC-EVT-009: status filter works', async () => {
    const createRes = await request(ctx.app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validEvent);

    await request(ctx.app)
      .put(`/api/events/${createRes.body.result.id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(ctx.app).get('/api/events?status=Published');

    expect(res.status).toBe(200);
    const statuses = res.body.result.items.map((e: { status: string }) => e.status);
    expect(statuses.every((s: string) => s === 'Published')).toBe(true);
  });

  it('TC-EVT-010: timeframe filter works', async () => {
    const res = await request(ctx.app).get('/api/events?timeframe=upcoming');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.result.items)).toBe(true);
  });

  it('TC-EVT-011: sort by date-desc works', async () => {
    const res = await request(ctx.app).get('/api/events?sort=date-desc');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.result.items)).toBe(true);
  });

  it('TC-EVT-012: visibility rule — anon sees only Published', async () => {
    await request(ctx.app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validEvent);

    const res = await request(ctx.app).get('/api/events');

    expect(res.status).toBe(200);
    const statuses = res.body.result.items.map((e: { status: string }) => e.status);
    expect(statuses.every((s: string) => s === 'Published')).toBe(true);
  });

  it('TC-EVT-014: authenticated admin sees non-published statuses', async () => {
    await request(ctx.app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validEvent, title: 'Draft Visibility Check' });

    const res = await request(ctx.app)
      .get('/api/events?status=Draft')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const statuses = res.body.result.items.map((e: { status: string }) => e.status);
    expect(statuses.length).toBeGreaterThanOrEqual(1);
    expect(statuses.every((s: string) => s === 'Draft')).toBe(true);
  });

  it('TC-EVT-015: list items include goingCount', async () => {
    const createRes = await request(ctx.app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validEvent, title: 'Going Count Check' });

    await request(ctx.app)
      .put(`/api/events/${createRes.body.result.id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);

    await request(ctx.app)
      .post(`/api/events/${createRes.body.result.id}/rsvps`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ guestCount: 2 });

    const res = await request(ctx.app)
      .get('/api/events?search=Going Count Check')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.result.items[0].goingCount).toBe(2);
  });

  it('TC-EVT-016: list items include maybeCount', async () => {
    const createRes = await request(ctx.app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validEvent, title: 'Maybe Count Check' });

    await request(ctx.app)
      .put(`/api/events/${createRes.body.result.id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);

    const rsvpRes = await request(ctx.app)
      .post(`/api/events/${createRes.body.result.id}/rsvps`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ guestCount: 1 });

    await request(ctx.app)
      .put(`/api/rsvps/${rsvpRes.body.result.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Maybe' });

    const res = await request(ctx.app).get('/api/events?search=Maybe Count Check');

    expect(res.status).toBe(200);
    expect(res.body.result.items[0].maybeCount).toBe(1);
    expect(res.body.result.items[0].goingCount).toBe(0);
  });

  it('TC-EVT-017: owner can fetch their own draft by id', async () => {
    const createRes = await request(ctx.app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validEvent, title: 'Draft Fetch Check' });

    const res = await request(ctx.app)
      .get(`/api/events/${createRes.body.result.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.result.status).toBe('Draft');
  });

  it('TC-EVT-018: anonymous cannot fetch a draft by id', async () => {
    const createRes = await request(ctx.app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validEvent, title: 'Draft Hidden Check' });

    const res = await request(ctx.app).get(`/api/events/${createRes.body.result.id}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/events/my', () => {
  it('TC-EVT-013: returns caller events', async () => {
    await request(ctx.app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validEvent);

    const res = await request(ctx.app)
      .get('/api/events/my')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.result)).toBe(true);
    expect(res.body.result.length).toBeGreaterThanOrEqual(1);
  });

  it('TC-EVT-014: returns 401 without auth', async () => {
    const res = await request(ctx.app).get('/api/events/my');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/events/:id', () => {
  it('TC-EVT-015: returns single event', async () => {
    const createRes = await request(ctx.app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validEvent);

    await request(ctx.app)
      .put(`/api/events/${createRes.body.result.id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(ctx.app).get(`/api/events/${createRes.body.result.id}`);

    expect(res.status).toBe(200);
    expect(res.body.result.id).toBe(createRes.body.result.id);
  });

  it('TC-EVT-016: returns 404 for non-published (anon)', async () => {
    const createRes = await request(ctx.app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validEvent);

    const res = await request(ctx.app).get(`/api/events/${createRes.body.result.id}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/events/:id — non-published visibility', () => {
  let organizerToken: string;

  beforeEach(async () => {
    await request(ctx.app).post('/api/users').set('Authorization', `Bearer ${adminToken}`).send({
      email: 'event-owner@test.example.com',
      displayName: 'Event Owner',
      password: 'password123',
      roleId: organizerRoleId,
    });

    const login = await loginUser(ctx.app, 'event-owner@test.example.com', 'password123');
    organizerToken = login.accessToken;
  });

  async function createDraft(): Promise<string> {
    const res = await request(ctx.app)
      .post('/api/events')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send(validEvent);

    expect(res.status).toBe(201);
    return res.body.result.id;
  }

  it('TC-EVT-024: organizer-role owner reads their own Draft', async () => {
    const id = await createDraft();

    const res = await request(ctx.app)
      .get(`/api/events/${id}`)
      .set('Authorization', `Bearer ${organizerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.result.status).toBe('Draft');
  });

  it('TC-EVT-025: authenticated non-owner reads a Draft', async () => {
    const id = await createDraft();

    const res = await request(ctx.app)
      .get(`/api/events/${id}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(404);
  });

  it('TC-EVT-026: anonymous reads a Draft', async () => {
    const id = await createDraft();

    const res = await request(ctx.app).get(`/api/events/${id}`);

    expect(res.status).toBe(404);
  });

  it('TC-EVT-027: admin reads a Draft they do not own', async () => {
    const id = await createDraft();

    const res = await request(ctx.app)
      .get(`/api/events/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  it('TC-EVT-028: missing event still returns 404', async () => {
    const res = await request(ctx.app)
      .get('/api/events/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/events/:id', () => {
  it('TC-EVT-017: updates event', async () => {
    const createRes = await request(ctx.app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validEvent);

    const res = await request(ctx.app)
      .put(`/api/events/${createRes.body.result.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validEvent, title: 'Updated Event' });

    expect(res.status).toBe(200);
    expect(res.body.result.title).toBe('Updated Event');
  });

  it('TC-EVT-018: returns 403 for non-owner', async () => {
    const createRes = await request(ctx.app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validEvent);

    const res = await request(ctx.app)
      .put(`/api/events/${createRes.body.result.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ ...validEvent, title: 'Hacked' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/events/:id', () => {
  it('TC-EVT-019: deletes event', async () => {
    const createRes = await request(ctx.app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validEvent);

    const delRes = await request(ctx.app)
      .delete(`/api/events/${createRes.body.result.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(delRes.status).toBe(204);

    const getRes = await request(ctx.app)
      .get(`/api/events/${createRes.body.result.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(getRes.status).toBe(404);
  });

  it('TC-EVT-020: returns 403 for non-owner', async () => {
    const createRes = await request(ctx.app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validEvent);

    const res = await request(ctx.app)
      .delete(`/api/events/${createRes.body.result.id}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });
});

describe('Lifecycle endpoints', () => {
  it('TC-EVT-021: publish transitions to Published', async () => {
    const createRes = await request(ctx.app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validEvent);

    const res = await request(ctx.app)
      .put(`/api/events/${createRes.body.result.id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.result.status).toBe('Published');
  });

  it('TC-EVT-022: cancel transitions to Cancelled', async () => {
    const createRes = await request(ctx.app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validEvent);

    const res = await request(ctx.app)
      .put(`/api/events/${createRes.body.result.id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.result.status).toBe('Cancelled');
  });

  it('TC-EVT-023: complete transitions to Completed', async () => {
    const createRes = await request(ctx.app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validEvent);

    const res = await request(ctx.app)
      .put(`/api/events/${createRes.body.result.id}/complete`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.result.status).toBe('Completed');
  });
});
