import { Router } from 'express';
import { validate } from '../../../shared/http/middleware/validate.js';
import { requireAuth } from '../../../shared/http/middleware/require-auth.js';
import { requirePermission } from '../../../shared/http/middleware/require-permission.js';
import { grantSchema, revokeSchema, checkSchema } from './permission.schemas.js';
import { createPermissionController } from './permission.controller.js';

export function createPermissionRoutes(
  permissionService: Parameters<typeof createPermissionController>[0],
) {
  const controller = createPermissionController(permissionService);
  const router = Router();

  router.get('/api/permissions', requireAuth, (req, res) => controller.getCatalog(req, res));
  router.get(
    '/api/permissions/user/:userId',
    requireAuth,
    requirePermission('Users.View'),
    (req, res) => controller.getEffective(req, res),
  );
  router.get(
    '/api/permissions/check',
    requireAuth,
    validate(checkSchema),
    requirePermission('Users.View'),
    (req, res) => controller.check(req, res),
  );
  router.post(
    '/api/permissions/grant',
    requireAuth,
    validate(grantSchema),
    requirePermission('Users.Manage'),
    (req, res) => controller.grant(req, res),
  );
  router.post(
    '/api/permissions/revoke',
    requireAuth,
    validate(revokeSchema),
    requirePermission('Users.Manage'),
    (req, res) => controller.revoke(req, res),
  );

  return router;
}
