import { Router } from 'express';
import { validate } from '../../../shared/http/middleware/validate.js';
import { requireAuth } from '../../../shared/http/middleware/require-auth.js';
import { requirePermission } from '../../../shared/http/middleware/require-permission.js';
import { attachUserIfPresent } from '../../../shared/http/middleware/attach-user-if-present.js';
import { PERMISSIONS } from '../../../shared/application/permissions.js';
import {
  createEventSchema,
  updateEventSchema,
  eventListQuerySchema,
  eventIdParamSchema,
} from './event.schemas.js';
import { createEventController } from './event.controller.js';

export function createEventRoutes(eventService: Parameters<typeof createEventController>[0]) {
  const controller = createEventController(eventService);
  const router = Router();

  router.get(
    '/api/events',
    attachUserIfPresent,
    validate(eventListQuerySchema),
    (req, res) => controller.list(req, res),
  );

  router.get(
    '/api/events/my',
    requireAuth,
    requirePermission(PERMISSIONS.Events.View),
    (req, res) => controller.getMyEvents(req, res),
  );

  router.get(
    '/api/events/:id',
    attachUserIfPresent,
    validate(eventIdParamSchema),
    (req, res) => controller.getById(req, res),
  );

  router.post(
    '/api/events',
    requireAuth,
    requirePermission(PERMISSIONS.Events.Create),
    validate(createEventSchema),
    (req, res) => controller.create(req, res),
  );

  router.put(
    '/api/events/:id',
    requireAuth,
    requirePermission(PERMISSIONS.Events.Edit),
    validate(updateEventSchema),
    (req, res) => controller.update(req, res),
  );

  router.delete(
    '/api/events/:id',
    requireAuth,
    requirePermission(PERMISSIONS.Events.Delete),
    validate(eventIdParamSchema),
    (req, res) => controller.remove(req, res),
  );

  router.put(
    '/api/events/:id/publish',
    requireAuth,
    requirePermission(PERMISSIONS.Events.Edit),
    validate(eventIdParamSchema),
    (req, res) => controller.publish(req, res),
  );

  router.put(
    '/api/events/:id/cancel',
    requireAuth,
    requirePermission(PERMISSIONS.Events.Edit),
    validate(eventIdParamSchema),
    (req, res) => controller.cancel(req, res),
  );

  router.put(
    '/api/events/:id/complete',
    requireAuth,
    requirePermission(PERMISSIONS.Events.Edit),
    validate(eventIdParamSchema),
    (req, res) => controller.complete(req, res),
  );

  return router;
}
