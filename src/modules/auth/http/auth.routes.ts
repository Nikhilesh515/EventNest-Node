import { Router } from 'express';
import { validate } from '../../../shared/http/middleware/validate.js';
import { registerSchema, loginSchema, refreshSchema, logoutSchema } from './auth.schemas.js';
import { createAuthController } from './auth.controller.js';

export function createAuthRoutes(authService: Parameters<typeof createAuthController>[0]) {
  const controller = createAuthController(authService);
  const router = Router();

  router.post('/api/auth/register', validate(registerSchema), (req, res) =>
    controller.register(req, res),
  );
  router.post('/api/auth/login', validate(loginSchema), (req, res) => controller.login(req, res));
  router.post('/api/auth/refresh', validate(refreshSchema), (req, res) =>
    controller.refresh(req, res),
  );
  router.post('/api/auth/logout', validate(logoutSchema), (req, res) =>
    controller.logout(req, res),
  );

  return router;
}
