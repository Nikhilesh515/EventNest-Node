import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../../../src/shared/domain/errors.js';
import { validate } from '../../../src/shared/http/middleware/validate.js';

function runMiddleware(
  middleware: ReturnType<typeof validate>,
  req: Record<string, unknown>,
): ReturnType<typeof vi.fn> {
  const next = vi.fn();
  middleware(req as unknown as Request, {} as unknown as Response, next as unknown as NextFunction);
  return next;
}

describe('TC-CORE-060: Each target validated independently', () => {
  it('validates params only and leaves query and body untouched', () => {
    const params = { id: '3f2a9c1e-8d4b-4f6a-9e2c-1b7d5a8f0c33' };
    const query = { untouched: 'yes' };
    const body = { untouched: true };
    const req: Record<string, unknown> = {
      params,
      query,
      body,
    };

    const next = runMiddleware(validate({ params: z.object({ id: z.string().uuid() }) }), req);

    expect(next).toHaveBeenCalledWith();
    expect(req['query']).toBe(query);
    expect(req['body']).toBe(body);
  });

  it('validates body only and leaves query and params untouched', () => {
    const params = { untouched: 'yes' };
    const query = { page: '1' };
    const body = { name: 'Workshops' };
    const req: Record<string, unknown> = { params, query, body };

    const next = runMiddleware(validate({ body: z.object({ name: z.string() }) }), req);

    expect(next).toHaveBeenCalledWith();
    expect(req['params']).toBe(params);
    expect(req['query']).toBe(query);
  });

  it('validates all three targets together and applies parsed values', () => {
    const req: Record<string, unknown> = {
      params: { id: '3f2a9c1e-8d4b-4f6a-9e2c-1b7d5a8f0c33' },
      query: { page: '2' },
      body: { name: 'Workshops' },
    };

    const next = runMiddleware(
      validate({
        params: z.object({ id: z.string().uuid() }),
        query: z.object({ page: z.coerce.number().int() }),
        body: z.object({ name: z.string() }),
      }),
      req,
    );

    expect(next).toHaveBeenCalledWith();
    expect(req['query']).toEqual({ page: 2 });
    expect(req['body']).toEqual({ name: 'Workshops' });
  });
});

describe('TC-CORE-062: All issues aggregate with dotted keys', () => {
  it('aggregates failures across body and query into one ValidationError', () => {
    const next = runMiddleware(
      validate({
        body: z.object({
          email: z.string().min(1, 'Email is required.'),
          guestCount: z.number().min(1, 'Guest count must be at least 1.'),
        }),
        query: z.object({ status: z.string().min(1, 'Status is required.') }),
      }),
      {
        body: { email: '', guestCount: 0 },
        query: {},
        params: {},
      },
    );

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0]?.[0] as ValidationError;

    expect(error).toBeInstanceOf(ValidationError);
    expect(Object.keys(error.errors ?? {}).sort()).toEqual(['email', 'guestCount', 'status']);
    expect(error.errors?.['email']).toEqual(['Email is required.']);
    expect(error.errors?.['guestCount']).toEqual(['Guest count must be at least 1.']);
    expect(error.errors?.['status']?.length).toBeGreaterThan(0);
  });

  it('falls back to the target name for root-level failures', () => {
    const next = runMiddleware(validate({ body: z.string() }), {
      body: 42,
      query: {},
      params: {},
    });

    const error = next.mock.calls[0]?.[0] as ValidationError;

    expect(error).toBeInstanceOf(ValidationError);
    expect(Object.keys(error.errors ?? {})).toEqual(['body']);
  });
});

describe('TC-CORE-063: Default failure message', () => {
  it('uses the exact frozen message and passes it to the error handler', () => {
    const next = runMiddleware(validate({ body: z.object({ name: z.string() }) }), {
      body: {},
      query: {},
      params: {},
    });

    const error = next.mock.calls[0]?.[0] as ValidationError;

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toBe('Please check the highlighted fields.');
  });
});
