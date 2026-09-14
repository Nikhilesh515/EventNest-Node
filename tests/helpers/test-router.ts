import { Router } from 'express';
import { z } from 'zod';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  UnexpectedError,
  ValidationError,
} from '../../src/shared/domain/errors.js';
import { getRequestId } from '../../src/shared/http/request-context.js';
import { validate } from '../../src/shared/http/middleware/validate.js';
import { created, noContent, ok } from '../../src/shared/http/respond.js';

export function buildTestRouter(): Router {
  const router = Router();

  router.get('/api/_test/throw', () => {
    throw new NotFoundError('Gone.');
  });
  router.get('/api/_test/app-error', () => {
    throw new AppError('Teapot.', 418, { field: ['bad'] });
  });
  router.get('/api/_test/validation', () => {
    throw new ValidationError('Please check the highlighted fields.', {
      guestCount: ['Guest count must be at least 1.'],
    });
  });
  router.get('/api/_test/unauthorized', () => {
    throw new UnauthorizedError('Authentication is required.');
  });
  router.get('/api/_test/forbidden', () => {
    throw new ForbiddenError('Forbidden.');
  });
  router.get('/api/_test/not-found', () => {
    throw new NotFoundError('Resource not found.');
  });
  router.get('/api/_test/conflict', () => {
    throw new ConflictError('Conflict.');
  });
  router.get('/api/_test/conflict-map', () => {
    throw new ConflictError('Conflict.', { name: ['Already exists.'] });
  });
  router.get('/api/_test/unexpected', () => {
    throw new UnexpectedError('An unexpected error occurred.');
  });
  router.get('/api/_test/boom', () => {
    throw new Error('SECRET_INTERNAL_DETAIL');
  });

  router.get('/api/_test/ok', (_request, response) => {
    ok(response, { id: 1 });
  });
  router.get('/api/_test/ok-with-message', (_request, response) => {
    ok(response, { id: 1 }, 'Done');
  });
  router.post('/api/_test/create', (_request, response) => {
    created(response, { id: 42 }, '/api/_test/create/42');
  });
  router.delete('/api/_test/item', (_request, response) => {
    noContent(response);
  });

  router.get('/api/_test/echo-id', (request, response) => {
    ok(response, { requestId: getRequestId(request) });
  });

  router.get('/api/_test/log', (request, response) => {
    request.log.info({ marker: 'route-log' }, 'handled');
    ok(response, { logged: true });
  });

  router.get(
    '/api/_test/validated-query',
    validate({
      query: z.object({ page: z.coerce.number().int(), pageSize: z.coerce.number().int() }),
    }),
    (request, response) => {
      const query = request.query as unknown as { page: number; pageSize: number };
      ok(response, { page: query.page, pageSize: query.pageSize });
    },
  );

  router.post(
    '/api/_test/validated-body',
    validate({ body: z.object({ name: z.string(), color: z.string() }) }),
    (request, response) => {
      ok(response, request.body as Record<string, unknown>);
    },
  );

  router.post(
    '/api/_test/validated-rsvp',
    validate({
      body: z.object({ guestCount: z.number().min(1, 'Guest count must be at least 1.') }),
    }),
    (request, response) => {
      ok(response, request.body as Record<string, unknown>);
    },
  );

  return router;
}
