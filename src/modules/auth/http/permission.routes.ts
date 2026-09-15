import { Router } from 'express';
import { validate } from '../../../shared/http/middleware/validate.js';
import { requireAuth } from '../../../shared/http/middleware/require-auth.js';
import { requirePermission } from '../../../shared/http/middleware/require-permission.js';
import { grantSchema, revokeSchema } from './permission.schemas.js';
import { createPermissionController } from './permission.controller.js';

export function createPermissionRoutes(
  permissionService: Parameters<typeof createPermissionController>[0],
) {
  const controller = createPermissionController(permissionService);
  const router = Router();

  router.get('/api/permissions', requireAuth, (req, res) => controller.getCatalog(req, res));
  router.get(
    '/api/permissions/users/:userId',
    requireAuth,
    requirePermission('Users.View'),
    (req, res) => controller.getEffective(req, res),
  );
  router.post(
    '/api/permissions/grant',
    requireAuth,
    requirePermission('Users.Manage'),
    validate(grantSchema),
    (req, res) => controller.grant(req, res),
  );
  router.post(
    '/api/permissions/revoke',
    requireAuth,
    requirePermission('Users.Manage'),
    validate(revokeSchema),
    (req, res) => controller.revoke(req, res),
  );

  return router;
}
