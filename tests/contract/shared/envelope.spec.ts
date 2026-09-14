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

describe('TC-CORE-020: ok() success payload', () => {
  it('wraps the result with the default null message', async () => {
    const res = await request(app).get('/api/_test/ok');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      code: 200,
      success: true,
      message: null,
      result: { id: 1 },
      errors: null,
    });
  });

  it('passes the optional message through', async () => {
    const res = await request(app).get('/api/_test/ok-with-message');

    expect(res.body.message).toBe('Done');
  });
});

describe('TC-CORE-021: created() sets Location and 201', () => {
  it('responds 201 with the Location header and envelope', async () => {
    const res = await request(app).post('/api/_test/create');

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe('/api/_test/create/42');
    expect(res.body).toEqual({
      code: 201,
      success: true,
      message: null,
      result: { id: 42 },
      errors: null,
    });
  });
});

describe('TC-CORE-022: noContent() sends no body', () => {
  it('responds 204 with a zero-length body and no envelope', async () => {
    const res = await request(app).delete('/api/_test/item');

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(Object.keys(res.body as Record<string, unknown>)).toHaveLength(0);
  });
});

describe('TC-CORE-025: /health is exempt from the envelope', () => {
  it('keeps the documented health shape without envelope keys', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Healthy');
    expect(Array.isArray(res.body.checks)).toBe(true);
    expect(res.body).not.toHaveProperty('code');
    expect(res.body).not.toHaveProperty('success');
    expect(res.body).not.toHaveProperty('result');
    expect(res.body).not.toHaveProperty('errors');
  });
});
