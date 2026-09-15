import { Router } from 'express';
import { validate } from '../../../shared/http/middleware/validate.js';
import { requireAuth } from '../../../shared/http/middleware/require-auth.js';
import { requirePermission } from '../../../shared/http/middleware/require-permission.js';
import { PERMISSIONS } from '../../../shared/application/permissions.js';
import {
  createRsvpSchema,
  updateRsvpSchema,
  rsvpIdParamSchema,
  eventRsvpsParamSchema,
  userRsvpsParamSchema,
} from './rsvp.schemas.js';
import { createRsvpController } from './rsvp.controller.js';

export function createRsvpRoutes(rsvpService: Parameters<typeof createRsvpController>[0]) {
  const controller = createRsvpController(rsvpService);
  const router = Router();

  router.post(
    '/api/events/:eventId/rsvps',
    requireAuth,
    requirePermission(PERMISSIONS.RSVPs.Create),
    validate(createRsvpSchema),
    (req, res) => controller.create(req, res),
  );

  router.delete(
    '/api/events/:eventId/rsvps',
    requireAuth,
    requirePermission(PERMISSIONS.RSVPs.Cancel),
    validate(eventRsvpsParamSchema),
    (req, res) => controller.cancelOwn(req, res),
  );

  router.get(
    '/api/events/:eventId/rsvps',
    requireAuth,
    requirePermission(PERMISSIONS.RSVPs.Manage),
    validate(eventRsvpsParamSchema),
    (req, res) => controller.listByEvent(req, res),
  );

  router.get(
    '/api/rsvps/:id',
    requireAuth,
    requirePermission(PERMISSIONS.RSVPs.View),
    validate(rsvpIdParamSchema),
    (req, res) => controller.getById(req, res),
  );

  router.put(
    '/api/rsvps/:id',
    requireAuth,
    requirePermission(PERMISSIONS.RSVPs.Edit),
    validate(updateRsvpSchema),
    (req, res) => controller.update(req, res),
  );

  router.get(
    '/api/users/:userId/rsvps',
    requireAuth,
    requirePermission(PERMISSIONS.RSVPs.View),
    validate(userRsvpsParamSchema),
    (req, res) => controller.listByUser(req, res),
  );

  return router;
}
