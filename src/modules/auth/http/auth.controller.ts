import type { Request, Response } from 'express';
import type { AuthService } from '../application/auth.service.js';
import type { AppConfig } from '../../../config/env.js';
import { ok, noContent } from '../../../shared/http/respond.js';
import { readCookie } from '../../../shared/http/cookies.js';
import { REFRESH_COOKIE_NAME, setRefreshCookie, clearRefreshCookie } from './auth.cookies.js';

export function createAuthController(authService: AuthService, config: AppConfig) {
  return {
    async register(req: Request, res: Response) {
      const { body, refreshToken } = await authService.register(req.body);
      setRefreshCookie(res, refreshToken, config);
      ok(res, body);
    },

    async login(req: Request, res: Response) {
      const { body, refreshToken } = await authService.login(req.body);
      setRefreshCookie(res, refreshToken, config);
      ok(res, body);
    },

    async refresh(req: Request, res: Response) {
      const token = readCookie(req, REFRESH_COOKIE_NAME);
      const { body, refreshToken } = await authService.refresh(token);
      setRefreshCookie(res, refreshToken, config);
      ok(res, body);
    },

    async logout(req: Request, res: Response) {
      await authService.logout(readCookie(req, REFRESH_COOKIE_NAME));
      clearRefreshCookie(res, config);
      noContent(res);
    },
  };
}
