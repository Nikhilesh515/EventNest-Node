import { describe, expect, it } from 'vitest';
import {
  EmailAlreadyExistsError,
  InvalidCredentialsError,
  AccountDeactivatedError,
  InvalidRefreshTokenError,
  PermissionAlreadyGrantedError,
  PermissionNotGrantedError,
  UnknownPermissionError,
} from '../../../../src/modules/auth/domain/errors.js';
import {
  AppError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../../../src/shared/domain/errors.js';

describe('EmailAlreadyExistsError', () => {
  it('has statusCode 409', () => {
    const err = new EmailAlreadyExistsError('test@example.com');

    expect(err.statusCode).toBe(409);
  });

  it('has name "EmailAlreadyExistsError"', () => {
    const err = new EmailAlreadyExistsError('test@example.com');

    expect(err.name).toBe('EmailAlreadyExistsError');
  });

  it('is instanceof ConflictError', () => {
    const err = new EmailAlreadyExistsError('test@example.com');

    expect(err).toBeInstanceOf(ConflictError);
  });

  it('is instanceof AppError', () => {
    const err = new EmailAlreadyExistsError('test@example.com');

    expect(err).toBeInstanceOf(AppError);
  });

  it('includes the email in the message', () => {
    const err = new EmailAlreadyExistsError('test@example.com');

    expect(err.message).toBe("Email 'test@example.com' already exists.");
  });
});

describe('InvalidCredentialsError', () => {
  it('has statusCode 401', () => {
    const err = new InvalidCredentialsError();

    expect(err.statusCode).toBe(401);
  });

  it('has name "InvalidCredentialsError"', () => {
    const err = new InvalidCredentialsError();

    expect(err.name).toBe('InvalidCredentialsError');
  });

  it('is instanceof UnauthorizedError', () => {
    const err = new InvalidCredentialsError();

    expect(err).toBeInstanceOf(UnauthorizedError);
  });

  it('is instanceof AppError', () => {
    const err = new InvalidCredentialsError();

    expect(err).toBeInstanceOf(AppError);
  });

  it('has the correct message', () => {
    const err = new InvalidCredentialsError();

    expect(err.message).toBe('Invalid email or password.');
  });
});

describe('AccountDeactivatedError', () => {
  it('has statusCode 401', () => {
    const err = new AccountDeactivatedError();

    expect(err.statusCode).toBe(401);
  });

  it('has name "AccountDeactivatedError"', () => {
    const err = new AccountDeactivatedError();

    expect(err.name).toBe('AccountDeactivatedError');
  });

  it('is instanceof UnauthorizedError', () => {
    const err = new AccountDeactivatedError();

    expect(err).toBeInstanceOf(UnauthorizedError);
  });

  it('is instanceof AppError', () => {
    const err = new AccountDeactivatedError();

    expect(err).toBeInstanceOf(AppError);
  });

  it('has the correct message', () => {
    const err = new AccountDeactivatedError();

    expect(err.message).toBe('User account is deactivated.');
  });
});

describe('InvalidRefreshTokenError', () => {
  it('has statusCode 401', () => {
    const err = new InvalidRefreshTokenError();

    expect(err.statusCode).toBe(401);
  });

  it('has name "InvalidRefreshTokenError"', () => {
    const err = new InvalidRefreshTokenError();

    expect(err.name).toBe('InvalidRefreshTokenError');
  });

  it('is instanceof UnauthorizedError', () => {
    const err = new InvalidRefreshTokenError();

    expect(err).toBeInstanceOf(UnauthorizedError);
  });

  it('is instanceof AppError', () => {
    const err = new InvalidRefreshTokenError();

    expect(err).toBeInstanceOf(AppError);
  });

  it('has the correct message', () => {
    const err = new InvalidRefreshTokenError();

    expect(err.message).toBe('Invalid refresh token.');
  });
});

describe('PermissionAlreadyGrantedError', () => {
  it('has statusCode 409', () => {
    const err = new PermissionAlreadyGrantedError('Events.View', 'user-1');

    expect(err.statusCode).toBe(409);
  });

  it('has name "PermissionAlreadyGrantedError"', () => {
    const err = new PermissionAlreadyGrantedError('Events.View', 'user-1');

    expect(err.name).toBe('PermissionAlreadyGrantedError');
  });

  it('is instanceof ConflictError', () => {
    const err = new PermissionAlreadyGrantedError('Events.View', 'user-1');

    expect(err).toBeInstanceOf(ConflictError);
  });

  it('is instanceof AppError', () => {
    const err = new PermissionAlreadyGrantedError('Events.View', 'user-1');

    expect(err).toBeInstanceOf(AppError);
  });

  it('includes permission name and user id in the message', () => {
    const err = new PermissionAlreadyGrantedError('Events.View', 'user-1');

    expect(err.message).toBe("Permission 'Events.View' is already granted to user 'user-1'.");
  });
});

describe('PermissionNotGrantedError', () => {
  it('has statusCode 404', () => {
    const err = new PermissionNotGrantedError('Events.View', 'user-1');

    expect(err.statusCode).toBe(404);
  });

  it('has name "PermissionNotGrantedError"', () => {
    const err = new PermissionNotGrantedError('Events.View', 'user-1');

    expect(err.name).toBe('PermissionNotGrantedError');
  });

  it('is instanceof NotFoundError', () => {
    const err = new PermissionNotGrantedError('Events.View', 'user-1');

    expect(err).toBeInstanceOf(NotFoundError);
  });

  it('is instanceof AppError', () => {
    const err = new PermissionNotGrantedError('Events.View', 'user-1');

    expect(err).toBeInstanceOf(AppError);
  });

  it('includes permission name and user id in the message', () => {
    const err = new PermissionNotGrantedError('Events.View', 'user-1');

    expect(err.message).toBe("Permission 'Events.View' is not granted to user 'user-1'.");
  });
});

describe('UnknownPermissionError', () => {
  it('has statusCode 400', () => {
    const err = new UnknownPermissionError('Events.Fly');

    expect(err.statusCode).toBe(400);
  });

  it('has name "UnknownPermissionError"', () => {
    const err = new UnknownPermissionError('Events.Fly');

    expect(err.name).toBe('UnknownPermissionError');
  });

  it('is instanceof ValidationError', () => {
    const err = new UnknownPermissionError('Events.Fly');

    expect(err).toBeInstanceOf(ValidationError);
  });

  it('is instanceof AppError', () => {
    const err = new UnknownPermissionError('Events.Fly');

    expect(err).toBeInstanceOf(AppError);
  });

  it('includes permission name in the message', () => {
    const err = new UnknownPermissionError('Events.Fly');

    expect(err.message).toBe("Unknown permission 'Events.Fly'.");
  });

  it('populates the errors field with the permission name', () => {
    const err = new UnknownPermissionError('Events.Fly');

    expect(err.errors).toEqual({
      permissionName: ["Unknown permission 'Events.Fly'."],
    });
  });
});
