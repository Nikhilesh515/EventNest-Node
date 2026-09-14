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

describe('TC-CORE-061: Coerced query values replace via redefinition', () => {
  it('exposes coerced numbers to the controller through req.query', async () => {
    const res = await request(app).get('/api/_test/validated-query?page=3&pageSize=10');

    expect(res.status).toBe(200);
    expect(res.body.result).toEqual({ page: 3, pageSize: 10 });
    expect(typeof res.body.result.page).toBe('number');
    expect(typeof res.body.result.pageSize).toBe('number');
  });
});

describe('TC-CORE-064: Unknown keys are stripped', () => {
  it('removes unknown body keys before the controller', async () => {
    const res = await request(app)
      .post('/api/_test/validated-body')
      .send({ name: 'Workshops', color: '#0ea5e9', isAdmin: true });

    expect(res.status).toBe(200);
    expect(res.body.result).toEqual({ name: 'Workshops', color: '#0ea5e9' });
    expect(res.body.result).not.toHaveProperty('isAdmin');
  });
});

describe('TC-CORE-065: 400 contract matches the API reference', () => {
  it('returns the frozen field-error shape for a failed body validation', async () => {
    const res = await request(app).post('/api/_test/validated-rsvp').send({ guestCount: 0 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      code: 400,
      success: false,
      message: 'Please check the highlighted fields.',
      result: null,
      errors: { guestCount: ['Guest count must be at least 1.'] },
    });
  });
});
