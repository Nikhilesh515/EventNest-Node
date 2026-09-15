import type { Request, Response } from 'express';
import type { AuthService } from '../application/auth.service.js';
import { ok, noContent } from '../../../shared/http/respond.js';

export function createAuthController(authService: AuthService) {
  return {
    async register(req: Request, res: Response) {
      const result = await authService.register(req.body);
      ok(res, result);
    },

    async login(req: Request, res: Response) {
      const result = await authService.login(req.body);
      ok(res, result);
    },

    async refresh(req: Request, res: Response) {
      const result = await authService.refresh(req.body.refreshToken);
      ok(res, result);
    },

    async logout(req: Request, res: Response) {
      await authService.logout(req.body.refreshToken);
      noContent(res);
    },
  };
}
