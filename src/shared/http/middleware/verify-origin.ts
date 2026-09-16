import type { RequestHandler } from 'express';
import { ForbiddenError } from '../../domain/errors.js';

export function verifyOrigin(allowedOrigins: string[]): RequestHandler {
  return (req, _res, next) => {
    const origin = req.headers.origin;
    if (!origin || allowedOrigins.includes(origin)) {
      next();
      return;
    }
    next(new ForbiddenError('Request origin is not allowed.'));
  };
}
