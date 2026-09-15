import type { ErrorRequestHandler } from 'express';
import type { Logger } from 'pino';
import { AppError } from '../../domain/errors.js';
import { getRequestId } from '../request-context.js';
import { fail } from '../respond.js';

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err, req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    const requestId = getRequestId(req);

    if (err instanceof AppError) {
      if (err.statusCode >= 500) {
        logger.error({ requestId, err, statusCode: err.statusCode }, err.message);
      } else {
        logger.warn({ requestId, statusCode: err.statusCode, message: err.message }, err.message);
      }
      fail(res, err.statusCode, err.message, err.errors);
      return;
    }

    logger.error({ requestId, err }, 'unhandled error');
    fail(res, 500, 'An unexpected error occurred.', null);
  };
}
