export type FieldErrors = Record<string, string[]>;

export class AppError extends Error {
  readonly statusCode: number;
  readonly errors: FieldErrors | null;

  constructor(
    message: string,
    statusCode: number,
    errors: FieldErrors | null = null,
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.errors = errors;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, errors: FieldErrors) {
    super(message, 400, errors);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, errors: FieldErrors | null = null) {
    super(message, 409, errors);
  }
}

export class UnexpectedError extends AppError {
  constructor(message = 'An unexpected error occurred.', cause?: unknown) {
    super(message, 500, null, cause);
  }
}
