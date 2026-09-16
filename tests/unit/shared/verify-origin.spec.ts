import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { verifyOrigin } from '../../../src/shared/http/middleware/verify-origin.js';
import { errorHandler } from '../../../src/shared/http/middleware/error-handler.js';
import { testLogger } from '../../helpers/test-setup.js';

const ALLOWED = ['http://localhost:5173'];

function buildApp() {
  const app = express();
  app.post('/guarded', verifyOrigin(ALLOWED), (_req, res) => {
    res.status(204).end();
  });
  app.use(errorHandler(testLogger()));
  return app;
}

describe('verifyOrigin', () => {
  it('allows a request from an allowlisted origin', async () => {
    const res = await request(buildApp()).post('/guarded').set('Origin', 'http://localhost:5173');

    expect(res.status).toBe(204);
  });

  it('allows a request without an Origin header (non-browser client)', async () => {
    const res = await request(buildApp()).post('/guarded');

    expect(res.status).toBe(204);
  });

  it('rejects a request from a disallowed origin with 403', async () => {
    const res = await request(buildApp()).post('/guarded').set('Origin', 'https://evil.example');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Request origin is not allowed.');
  });
});
