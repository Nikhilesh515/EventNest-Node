import { Router } from 'express';
import { validate } from '../../../shared/http/middleware/validate.js';
import { requireAuth } from '../../../shared/http/middleware/require-auth.js';
import { requirePermission } from '../../../shared/http/middleware/require-permission.js';
import { PERMISSIONS } from '../../../shared/application/permissions.js';
import { createTagSchema, updateTagSchema, tagIdParamSchema } from './tag.schemas.js';
import { createTagController } from './tag.controller.js';

export function createTagRoutes(tagService: Parameters<typeof createTagController>[0]) {
  const controller = createTagController(tagService);
  const router = Router();

  router.get('/api/tags', (req, res) => controller.getAll(req, res));

  router.get(
    '/api/tags/:id',
    validate(tagIdParamSchema),
    (req, res) => controller.getById(req, res),
  );

  router.post(
    '/api/tags',
    requireAuth,
    requirePermission(PERMISSIONS.Tags.Create),
    validate(createTagSchema),
    (req, res) => controller.create(req, res),
  );

  router.put(
    '/api/tags/:id',
    requireAuth,
    requirePermission(PERMISSIONS.Tags.Edit),
    validate(updateTagSchema),
    (req, res) => controller.update(req, res),
  );

  router.delete(
    '/api/tags/:id',
    requireAuth,
    requirePermission(PERMISSIONS.Tags.Delete),
    validate(tagIdParamSchema),
    (req, res) => controller.remove(req, res),
  );

  return router;
}
