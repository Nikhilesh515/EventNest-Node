import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
} from '../../../shared/domain/errors.js';
import type { FieldErrors } from '../../../shared/domain/errors.js';

export class EmailAlreadyExistsError extends ConflictError {
  constructor(email: string) {
    super(`Email '${email}' already exists.`);
  }
}

export class InvalidCredentialsError extends UnauthorizedError {
  constructor() {
    super('Invalid email or password.');
  }
}

export class AccountDeactivatedError extends UnauthorizedError {
  constructor() {
    super('Account has been deactivated.');
  }
}

export class InvalidRefreshTokenError extends UnauthorizedError {
  constructor() {
    super('Invalid or expired refresh token.');
  }
}

export class PermissionAlreadyGrantedError extends ConflictError {
  constructor(permissionName: string, userId: string) {
    super(`Permission '${permissionName}' is already granted to user '${userId}'.`);
  }
}

export class PermissionNotGrantedError extends NotFoundError {
  constructor(permissionName: string, userId: string) {
    super(`Permission '${permissionName}' is not granted to user '${userId}'.`);
  }
}

export class UnknownPermissionError extends ValidationError {
  constructor(permissionName: string) {
    const errors: FieldErrors = {
      permissionName: [`Unknown permission '${permissionName}'.`],
    };
    super(`Unknown permission '${permissionName}'.`, errors);
  }
}
