import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { buildRateLimiter } from '../../../src/shared/http/middleware/rate-limiter.js';

function fakeResponse() {
  const res = {
    setHeader: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res as unknown as Response & {
    setHeader: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

describe('buildRateLimiter', () => {
  it('allows requests under the limit', async () => {
    const limiter = buildRateLimiter(2);
    const next = vi.fn() as unknown as NextFunction;
    const res = fakeResponse();

    await limiter({ path: '/api/events' } as Request, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('skips GET /health without consuming points', async () => {
    const limiter = buildRateLimiter(0);
    const next = vi.fn() as unknown as NextFunction;
    const res = fakeResponse();

    await limiter({ path: '/health' } as Request, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 429 with Retry-After once the limit is exhausted', async () => {
    const limiter = buildRateLimiter(1);
    const next = vi.fn() as unknown as NextFunction;
    const res = fakeResponse();

    await limiter({ path: '/api/events' } as Request, res, next);
    await limiter({ path: '/api/events' } as Request, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '60');
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 429, success: false, message: 'Too many requests.' }),
    );
  });
});
