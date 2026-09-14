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

interface ErrorCase {
  path: string;
  status: number;
  message: string;
  errors: Record<string, string[]> | null;
}

const ERROR_CASES: ErrorCase[] = [
  { path: '/api/_test/app-error', status: 418, message: 'Teapot.', errors: { field: ['bad'] } },
  {
    path: '/api/_test/validation',
    status: 400,
    message: 'Please check the highlighted fields.',
    errors: { guestCount: ['Guest count must be at least 1.'] },
  },
  {
    path: '/api/_test/unauthorized',
    status: 401,
    message: 'Authentication is required.',
    errors: null,
  },
  { path: '/api/_test/forbidden', status: 403, message: 'Forbidden.', errors: null },
  { path: '/api/_test/not-found', status: 404, message: 'Resource not found.', errors: null },
  { path: '/api/_test/conflict', status: 409, message: 'Conflict.', errors: null },
  {
    path: '/api/_test/unexpected',
    status: 500,
    message: 'An unexpected error occurred.',
    errors: null,
  },
];

describe('TC-CORE-010: errorHandler serializes a throwing route', () => {
  it('returns the JSON envelope instead of the Express HTML error page', async () => {
    const res = await request(app).get('/api/_test/throw');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/^application\/json/);
    expect(res.body).toEqual({
      code: 404,
      success: false,
      message: 'Gone.',
      result: null,
      errors: null,
    });
  });
});

describe('TC-CORE-011: Every AppError maps to its status and envelope', () => {
  it.each(ERROR_CASES)('$path -> $status', async ({ path, status, message, errors }) => {
    const res = await request(app).get(path);

    expect(res.status).toBe(status);
    expect(res.headers['content-type']).toMatch(/^application\/json/);
    expect(res.body).toEqual({ code: status, success: false, message, result: null, errors });
  });
});

describe('TC-CORE-012: Unknown error maps to a leak-free 500', () => {
  it('uses the fixed message and leaks no internals', async () => {
    const res = await request(app).get('/api/_test/boom');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      code: 500,
      success: false,
      message: 'An unexpected error occurred.',
      result: null,
      errors: null,
    });

    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('stack');
    expect(serialized).not.toContain('SECRET_INTERNAL_DETAIL');
    expect(serialized).not.toContain('Error');
  });
});

describe('TC-CORE-013: Unmatched route returns the 404 envelope', () => {
  it('terminates unknown paths with the frozen 404 body', async () => {
    const res = await request(app).get('/api/nope');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      code: 404,
      success: false,
      message: 'Route not found.',
      result: null,
      errors: null,
    });
  });
});

describe('TC-CORE-016: Validation and Conflict error maps pass through', () => {
  it('returns the thrown ValidationError map unchanged', async () => {
    const res = await request(app).get('/api/_test/validation');

    expect(res.body.errors).toEqual({ guestCount: ['Guest count must be at least 1.'] });
  });

  it('returns the thrown ConflictError map unchanged', async () => {
    const res = await request(app).get('/api/_test/conflict-map');

    expect(res.body.errors).toEqual({ name: ['Already exists.'] });
  });
});

describe('TC-CORE-006: Expected failures never throw a raw Error', () => {
  const subclassRoutes: Array<[string, number]> = [
    ['/api/_test/validation', 400],
    ['/api/_test/unauthorized', 401],
    ['/api/_test/forbidden', 403],
    ['/api/_test/not-found', 404],
    ['/api/_test/conflict', 409],
    ['/api/_test/unexpected', 500],
  ];

  it.each(subclassRoutes)('%s -> %i failure envelope', async (path, status) => {
    const res = await request(app).get(path);

    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe(status);
    expect(res.headers['content-type']).toMatch(/^application\/json/);
  });
});
