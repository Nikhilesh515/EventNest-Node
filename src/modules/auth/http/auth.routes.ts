import { Router, type ErrorRequestHandler } from 'express';
import type { AppConfig } from '../../../config/env.js';
import type { AuthService } from '../application/auth.service.js';
import { InvalidRefreshTokenError } from '../domain/errors.js';
import { verifyOrigin } from '../../../shared/http/middleware/verify-origin.js';
import { validate } from '../../../shared/http/middleware/validate.js';
import { registerSchema, loginSchema } from './auth.schemas.js';
import { createAuthController } from './auth.controller.js';
import { clearRefreshCookie } from './auth.cookies.js';

export function createAuthRoutes(authService: AuthService, config: AppConfig) {
  const controller = createAuthController(authService, config);
  const originCheck = verifyOrigin(config.CORS_ORIGINS);
  const router = Router();

  router.post('/api/auth/register', validate(registerSchema), (req, res) =>
    controller.register(req, res),
  );
  router.post('/api/auth/login', validate(loginSchema), (req, res) => controller.login(req, res));
  router.post('/api/auth/refresh', originCheck, (req, res) => controller.refresh(req, res));
  router.post('/api/auth/logout', originCheck, (req, res) => controller.logout(req, res));

  const clearCookieOnInvalidRefresh: ErrorRequestHandler = (err, _req, res, next) => {
    if (err instanceof InvalidRefreshTokenError) {
      clearRefreshCookie(res, config);
    }
    next(err);
  };
  router.use(clearCookieOnInvalidRefresh);

  return router;
}
