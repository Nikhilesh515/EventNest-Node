import { describe, expect, it } from 'vitest';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  UnexpectedError,
  ValidationError,
} from '../../../src/shared/domain/errors.js';

describe('TC-CORE-001: AppError base contract', () => {
  it('extends Error and carries status, message, field map, cause, and stack', () => {
    const root = new Error('root cause');
    const err = new AppError('boom', 500, { field: ['bad'] }, root);

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.name).toBe('AppError');
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe('boom');
    expect(err.errors).toEqual({ field: ['bad'] });
    expect(err.cause).toBe(root);
    expect(typeof err.stack).toBe('string');
  });
});

describe('TC-CORE-002: ValidationError requires a field-error map', () => {
  it('is a 400 with the map passed through unchanged', () => {
    const errors = { email: ['Invalid email.'] };
    const err = new ValidationError('Please check the highlighted fields.', errors);

    expect(err).toBeInstanceOf(AppError);
    expect(err.name).toBe('ValidationError');
    expect(err.statusCode).toBe(400);
    expect(err.errors).toEqual(errors);
  });

  it('rejects a missing map at compile time', () => {
    // @ts-expect-error the field-error map is mandatory for ValidationError
    const err = new ValidationError('missing map');

    expect(err.statusCode).toBe(400);
  });
});

describe('TC-CORE-003: Unauthorized, Forbidden, and NotFound statuses', () => {
  const cases: Array<[AppError, number, string]> = [
    [new UnauthorizedError('Authentication is required.'), 401, 'UnauthorizedError'],
    [new ForbiddenError('Forbidden.'), 403, 'ForbiddenError'],
    [new NotFoundError('Resource not found.'), 404, 'NotFoundError'],
  ];

  it.each(cases)('status %i keeps name %s', (err, status, name) => {
    expect(err).toBeInstanceOf(AppError);
    expect(err.name).toBe(name);
    expect(err.statusCode).toBe(status);
  });
});

describe('TC-CORE-004: ConflictError optional map', () => {
  it('omits the map when not provided', () => {
    const err = new ConflictError('Conflict.');

    expect(err.statusCode).toBe(409);
    expect(err.errors).toBeNull();
  });

  it('preserves a provided map', () => {
    const errors = { name: ['Tag already exists.'] };
    const err = new ConflictError('Conflict.', errors);

    expect(err.errors).toEqual(errors);
  });
});

describe('TC-CORE-005: UnexpectedError retains its cause', () => {
  it('is a 500 that wraps the underlying error', () => {
    const root = new Error('low-level failure');
    const err = new UnexpectedError('An unexpected error occurred.', root);

    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(500);
    expect(err.cause).toBe(root);
  });
});

describe('TC-CORE-006: Expected failures never throw a raw Error', () => {
  it('every exported subclass derives from AppError', () => {
    const subclasses = [
      ValidationError,
      UnauthorizedError,
      ForbiddenError,
      NotFoundError,
      ConflictError,
      UnexpectedError,
    ];

    for (const Subclass of subclasses) {
      expect(Subclass.prototype).toBeInstanceOf(AppError);
    }
  });
});
