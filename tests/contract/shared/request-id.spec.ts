import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../src/app.js';
import { testConfig, testLogger } from '../../helpers/app.js';
import { buildTestRouter } from '../../helpers/test-router.js';

const app = createApp({
  config: testConfig(),
  logger: testLogger(),
  router: buildTestRouter(),
});

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('TC-CORE-050: Inbound X-Request-Id is reused and echoed', () => {
  it('preserves a valid inbound id on the header and on req.id', async () => {
    const res = await request(app).get('/api/_test/echo-id').set('X-Request-Id', 'client-abc-123');

    expect(res.headers['x-request-id']).toBe('client-abc-123');
    expect(res.body.result.requestId).toBe('client-abc-123');
  });
});

describe('TC-CORE-051: Absent X-Request-Id generates a UUID', () => {
  it('generates a unique UUID v4 for each request', async () => {
    const first = await request(app).get('/api/_test/echo-id');
    const second = await request(app).get('/api/_test/echo-id');

    expect(first.headers['x-request-id']).toMatch(UUID_V4);
    expect(second.headers['x-request-id']).toMatch(UUID_V4);
    expect(first.headers['x-request-id']).not.toBe(second.headers['x-request-id']);
  });

  it('replaces an oversized inbound id instead of echoing it', async () => {
    const oversized = 'x'.repeat(129);
    const res = await request(app).get('/api/_test/echo-id').set('X-Request-Id', oversized);

    expect(res.headers['x-request-id']).not.toBe(oversized);
    expect(res.headers['x-request-id']).toMatch(UUID_V4);
  });
});
