import { Router } from 'express';
import { validate } from '../../../shared/http/middleware/validate.js';
import { requireAuth } from '../../../shared/http/middleware/require-auth.js';
import { requirePermission } from '../../../shared/http/middleware/require-permission.js';
import { createRoleSchema, updateRoleSchema, roleIdParamSchema, assignUserRoleSchema } from './role.schemas.js';
import { createRoleController } from './role.controller.js';

export function createRoleRoutes(roleService: Parameters<typeof createRoleController>[0]) {
  const controller = createRoleController(roleService);
  const router = Router();

  router.get('/api/roles', requireAuth, requirePermission('Users.View'), (req, res) =>
    controller.list(req, res),
  );
  router.get(
    '/api/roles/:id',
    requireAuth,
    requirePermission('Users.View'),
    validate(roleIdParamSchema),
    (req, res) => controller.getById(req, res),
  );
  router.post(
    '/api/roles',
    requireAuth,
    requirePermission('Users.Manage'),
    validate(createRoleSchema),
    (req, res) => controller.create(req, res),
  );
  router.put(
    '/api/roles/:id',
    requireAuth,
    requirePermission('Users.Manage'),
    validate(updateRoleSchema),
    validate(roleIdParamSchema),
    (req, res) => controller.update(req, res),
  );
  router.delete(
    '/api/roles/:id',
    requireAuth,
    requirePermission('Users.Manage'),
    validate(roleIdParamSchema),
    (req, res) => controller.remove(req, res),
  );
  router.put(
    '/api/users/:id/role',
    requireAuth,
    requirePermission('Users.Manage'),
    validate(assignUserRoleSchema),
    (req, res) => controller.assignUserRole(req, res),
  );

  return router;
}
