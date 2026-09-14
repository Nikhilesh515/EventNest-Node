import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { created, fail, noContent, ok } from '../../../src/shared/http/respond.js';

function makeResponse(): Response {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    location: vi.fn(),
    end: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.location.mockReturnValue(res);
  return res as unknown as Response;
}

describe('TC-CORE-023: fail() failure shape', () => {
  it('returns the exact failure envelope', () => {
    const body = fail(makeResponse(), 400, 'Please check the highlighted fields.', {
      email: ['Invalid email.'],
    });

    expect(body).toEqual({
      code: 400,
      success: false,
      message: 'Please check the highlighted fields.',
      result: null,
      errors: { email: ['Invalid email.'] },
    });
  });

  it('defaults errors to null', () => {
    const body = fail(makeResponse(), 500, 'An unexpected error occurred.');

    expect(body.errors).toBeNull();
  });
});

describe('TC-CORE-024: Envelope key set is exactly frozen', () => {
  it('keeps exactly the five frozen keys on every helper body', () => {
    const bodies = [
      ok(makeResponse(), {}),
      created(makeResponse(), {}, '/api/_test/create/42'),
      fail(makeResponse(), 404, 'Route not found.'),
    ];

    for (const body of bodies) {
      expect(Object.keys(body).sort()).toEqual(['code', 'errors', 'message', 'result', 'success']);
    }
  });

  it('noContent writes no body', () => {
    const res = makeResponse();

    noContent(res);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalledTimes(1);
    expect(res.json).not.toHaveBeenCalled();
  });
});
