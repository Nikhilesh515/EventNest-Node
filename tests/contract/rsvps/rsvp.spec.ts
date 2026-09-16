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
let userId: string;

const now = Date.now();
const day = 86_400_000;

beforeAll(async () => {
  ctx = await getSharedTestApp();
  const admin = await loginUser(ctx.app, 'admin@eventnest.io', 'Admin@123');
  adminToken = admin.accessToken;
});

afterAll(async () => {
  await destroySharedTestApp();
});

beforeEach(async () => {
  await resetTestData(ctx.knex);
  const user = await registerUser(ctx.app, 'rsvpuser@test.example.com', 'password123', 'RSVP User');
  userToken = user.accessToken;
  userId = user.userId;
});

async function createPublishedEvent(token: string, capacity = 100): Promise<string> {
  const res = await request(ctx.app)
    .post('/api/events')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: `Event ${Date.now()}-${Math.random()}`,
      startsAt: new Date(now + 30 * day).toISOString(),
      endsAt: new Date(now + 30 * day + 3 * 3_600_000).toISOString(),
      capacity,
    });
  const eventId = res.body.result.id;
  await request(ctx.app)
    .put(`/api/events/${eventId}/publish`)
    .set('Authorization', `Bearer ${token}`);
  return eventId;
}

async function createDraftEvent(token: string): Promise<string> {
  const res = await request(ctx.app)
    .post('/api/events')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: `Draft ${Date.now()}-${Math.random()}`,
      startsAt: new Date(now + 30 * day).toISOString(),
      endsAt: new Date(now + 30 * day + 3 * 3_600_000).toISOString(),
      capacity: 100,
    });
  return res.body.result.id;
}

describe('POST /api/events/:eventId/rsvps', () => {
  it('TC-RSVP-001: creates RSVP as Confirmed', async () => {
    const eventId = await createPublishedEvent(adminToken);
    const res = await request(ctx.app)
      .post(`/api/events/${eventId}/rsvps`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ guestCount: 2, notes: 'Vegetarian meal' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.result.status).toBe('Confirmed');
    expect(res.body.result.guestCount).toBe(2);
    expect(res.body.result.notes).toBe('Vegetarian meal');
    expect(res.headers.location).toContain('/api/rsvps/');
  });

  it('TC-RSVP-002: returns 409 for duplicate non-cancelled RSVP', async () => {
    const eventId = await createPublishedEvent(adminToken);
    await request(ctx.app)
      .post(`/api/events/${eventId}/rsvps`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ guestCount: 1 });

    const res = await request(ctx.app)
      .post(`/api/events/${eventId}/rsvps`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ guestCount: 1 });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain("Already RSVP'd");
  });

  it('TC-RSVP-003: reactivates cancelled RSVP', async () => {
    const eventId = await createPublishedEvent(adminToken);
    await request(ctx.app)
      .post(`/api/events/${eventId}/rsvps`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ guestCount: 1 });

    await request(ctx.app)
      .delete(`/api/events/${eventId}/rsvps`)
      .set('Authorization', `Bearer ${userToken}`);

    const res = await request(ctx.app)
      .post(`/api/events/${eventId}/rsvps`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ guestCount: 2 });

    expect(res.status).toBe(201);
    expect(res.body.result.status).toBe('Confirmed');
    expect(res.body.result.guestCount).toBe(2);
  });

  it('TC-RSVP-004: returns 404 for missing event', async () => {
    const res = await request(ctx.app)
      .post('/api/events/00000000-0000-0000-0000-000000000000/rsvps')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ guestCount: 1 });

    expect(res.status).toBe(404);
  });

  it('TC-RSVP-005: returns 400 for non-published event', async () => {
    const eventId = await createDraftEvent(adminToken);
    const res = await request(ctx.app)
      .post(`/api/events/${eventId}/rsvps`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ guestCount: 1 });

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  it('TC-RSVP-006: returns 400 when capacity exceeded', async () => {
    const eventId = await createPublishedEvent(adminToken, 1);
    await request(ctx.app)
      .post(`/api/events/${eventId}/rsvps`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ guestCount: 1 });

    const res = await request(ctx.app)
      .post(`/api/events/${eventId}/rsvps`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ guestCount: 1 });

    expect(res.status).toBe(400);
    expect(res.body.errors.guestCount).toBeDefined();
  });

  it('TC-RSVP-007: returns 401 without auth', async () => {
    const eventId = await createPublishedEvent(adminToken);
    const res = await request(ctx.app).post(`/api/events/${eventId}/rsvps`).send({ guestCount: 1 });

    expect(res.status).toBe(401);
  });

  it('TC-RSVP-008: normalizes guestCount < 1 to 1', async () => {
    const eventId = await createPublishedEvent(adminToken);
    const res = await request(ctx.app)
      .post(`/api/events/${eventId}/rsvps`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ guestCount: 0 });

    expect(res.status).toBe(201);
    expect(res.body.result.guestCount).toBe(1);
  });
});

describe('DELETE /api/events/:eventId/rsvps', () => {
  it('TC-RSVP-009: cancels own RSVP → 204', async () => {
    const eventId = await createPublishedEvent(adminToken);
    await request(ctx.app)
      .post(`/api/events/${eventId}/rsvps`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ guestCount: 1 });

    const res = await request(ctx.app)
      .delete(`/api/events/${eventId}/rsvps`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(204);
  });

  it('TC-RSVP-010: returns 404 if no RSVP', async () => {
    const eventId = await createPublishedEvent(adminToken);
    const res = await request(ctx.app)
      .delete(`/api/events/${eventId}/rsvps`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/events/:eventId/rsvps', () => {
  it('TC-RSVP-011: returns RSVPs with eventTitle', async () => {
    const eventId = await createPublishedEvent(adminToken);
    await request(ctx.app)
      .post(`/api/events/${eventId}/rsvps`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ guestCount: 1 });

    const res = await request(ctx.app)
      .get(`/api/events/${eventId}/rsvps`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.result)).toBe(true);
    expect(res.body.result.length).toBeGreaterThanOrEqual(1);
    expect(res.body.result[0].eventTitle).toBeDefined();
  });

  it('TC-RSVP-012: returns 403 without Manage permission', async () => {
    const eventId = await createPublishedEvent(adminToken);
    const res = await request(ctx.app)
      .get(`/api/events/${eventId}/rsvps`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/rsvps/:id', () => {
  it('TC-RSVP-013: returns single RSVP', async () => {
    const eventId = await createPublishedEvent(adminToken);
    const createRes = await request(ctx.app)
      .post(`/api/events/${eventId}/rsvps`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ guestCount: 1 });

    const res = await request(ctx.app)
      .get(`/api/rsvps/${createRes.body.result.id}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.result.id).toBe(createRes.body.result.id);
  });

  it('TC-RSVP-014: returns 404 for unknown ID', async () => {
    const res = await request(ctx.app)
      .get('/api/rsvps/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/rsvps/:id', () => {
  it('TC-RSVP-015: updates status', async () => {
    const eventId = await createPublishedEvent(adminToken);
    const createRes = await request(ctx.app)
      .post(`/api/events/${eventId}/rsvps`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ guestCount: 1 });

    const res = await request(ctx.app)
      .put(`/api/rsvps/${createRes.body.result.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ status: 'Maybe' });

    expect(res.status).toBe(200);
    expect(res.body.result.status).toBe('Maybe');
  });

  it('TC-RSVP-016: returns 401 for ownership violation', async () => {
    const eventId = await createPublishedEvent(adminToken);
    const createRes = await request(ctx.app)
      .post(`/api/events/${eventId}/rsvps`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ guestCount: 1 });

    const otherUser = await registerUser(ctx.app, 'other@test.example.com', 'password123', 'Other');

    const res = await request(ctx.app)
      .put(`/api/rsvps/${createRes.body.result.id}`)
      .set('Authorization', `Bearer ${otherUser.accessToken}`)
      .send({ status: 'Maybe' });

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('own RSVP');
  });

  it('TC-RSVP-017: returns 400 for invalid status', async () => {
    const eventId = await createPublishedEvent(adminToken);
    const createRes = await request(ctx.app)
      .post(`/api/events/${eventId}/rsvps`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ guestCount: 1 });

    const res = await request(ctx.app)
      .put(`/api/rsvps/${createRes.body.result.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ status: 'Invalid' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });
});

describe('GET /api/users/:userId/rsvps', () => {
  it('TC-RSVP-018: returns user RSVPs with eventTitle', async () => {
    const eventId = await createPublishedEvent(adminToken);
    await request(ctx.app)
      .post(`/api/events/${eventId}/rsvps`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ guestCount: 1 });

    const res = await request(ctx.app)
      .get(`/api/users/${userId}/rsvps`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.result)).toBe(true);
    expect(res.body.result.length).toBeGreaterThanOrEqual(1);
    expect(res.body.result[0].eventTitle).toBeDefined();
  });
});
