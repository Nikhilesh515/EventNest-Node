import type { NextFunction, Request, Response } from 'express';
import type { Logger } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../../src/shared/domain/errors.js';
import { errorHandler } from '../../../src/shared/http/middleware/error-handler.js';

function makeResponse(headersSent = false) {
  const res = {
    headersSent,
    status: vi.fn(),
    json: vi.fn(),
    location: vi.fn(),
    end: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.location.mockReturnValue(res);
  return res;
}

function makeLogger() {
  return { warn: vi.fn(), error: vi.fn() } as unknown as Logger;
}

function invoke(
  handler: ReturnType<typeof errorHandler>,
  err: unknown,
  res: ReturnType<typeof makeResponse>,
  next: ReturnType<typeof vi.fn>,
) {
  handler(
    err as Error,
    { id: 'req-1' } as unknown as Request,
    res as unknown as Response,
    next as unknown as NextFunction,
  );
}

describe('TC-CORE-015: Logging rules for 4xx and 5xx', () => {
  it('logs 4xx at warn with requestId, status, message and no err field', () => {
    const logger = makeLogger();
    const res = makeResponse();
    const next = vi.fn();

    invoke(errorHandler(logger), new NotFoundError('Missing.'), res, next);

    expect(logger.warn).toHaveBeenCalledTimes(1);
    const warn = logger.warn as unknown as ReturnType<typeof vi.fn>;
    const [fields, message] = warn.mock.calls[0] as [Record<string, unknown>, string];

    expect(fields).toEqual({ requestId: 'req-1', statusCode: 404, message: 'Missing.' });
    expect(fields).not.toHaveProperty('err');
    expect(message).toBe('Missing.');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs unknown errors at error with requestId and the original error', () => {
    const logger = makeLogger();
    const res = makeResponse();
    const next = vi.fn();
    const root = new Error('kaboom');

    invoke(errorHandler(logger), root, res, next);

    expect(logger.error).toHaveBeenCalledTimes(1);
    const error = logger.error as unknown as ReturnType<typeof vi.fn>;
    const [fields] = error.mock.calls[0] as [Record<string, unknown>];

    expect(fields).toMatchObject({ requestId: 'req-1', statusCode: 500 });
    expect(fields.err).toBe(root);
  });
});

describe('TC-CORE-014: errorHandler defers when headers already sent', () => {
  it('calls next(err) and never writes a response', () => {
    const logger = makeLogger();
    const res = makeResponse(true);
    const next = vi.fn();
    const err = new Error('late failure');

    invoke(errorHandler(logger), err, res, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });
});
