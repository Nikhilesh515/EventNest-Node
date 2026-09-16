import { Router } from 'express';
import { validate } from '../../../shared/http/middleware/validate.js';
import { requireAuth } from '../../../shared/http/middleware/require-auth.js';
import { requirePermission } from '../../../shared/http/middleware/require-permission.js';
import { updateUserSchema, listUsersSchema, createAdminUserSchema } from './user.schemas.js';
import { createUserController } from './user.controller.js';

export function createUserRoutes(userService: Parameters<typeof createUserController>[0]) {
  const controller = createUserController(userService);
  const router = Router();

  router.get('/api/users/me', requireAuth, (req, res) => controller.getMe(req, res));
  router.get('/api/users/:id', requireAuth, requirePermission('Users.View'), (req, res) =>
    controller.getById(req, res),
  );
  router.get(
    '/api/users',
    requireAuth,
    requirePermission('Users.View'),
    validate(listUsersSchema),
    (req, res) => controller.list(req, res),
  );
  router.post(
    '/api/users',
    requireAuth,
    requirePermission('Users.Manage'),
    validate(createAdminUserSchema),
    (req, res) => controller.createByAdmin(req, res),
  );
  router.put(
    '/api/users/:id',
    requireAuth,
    requirePermission('Users.Manage'),
    validate(updateUserSchema),
    (req, res) => controller.update(req, res),
  );
  router.delete('/api/users/:id', requireAuth, requirePermission('Users.Manage'), (req, res) =>
    controller.remove(req, res),
  );

  return router;
}
