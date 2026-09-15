import type { Request, Response } from 'express';
import type { UserService } from '../application/user.service.js';
import { ok, noContent } from '../../../shared/http/respond.js';
import { UnauthorizedError } from '../../../shared/domain/errors.js';

export function createUserController(userService: UserService) {
  return {
    async getMe(req: Request, res: Response) {
      if (!req.user) {
        throw new UnauthorizedError('Authentication is required.');
      }
      const result = await userService.getMe(req.user.id);
      ok(res, result);
    },

    async getById(req: Request, res: Response) {
      const id = req.params.id as string;
      const result = await userService.getById(id);
      ok(res, result);
    },

    async list(req: Request, res: Response) {
      const page = Number(req.query.page) || 1;
      const pageSize = Number(req.query.pageSize) || 20;
      const result = await userService.list(page, pageSize);
      ok(res, result);
    },

    async update(req: Request, res: Response) {
      const id = req.params.id as string;
      const body = req.body as { displayName?: string };
      const result = await userService.update(id, body.displayName !== undefined ? { displayName: body.displayName } : {});
      ok(res, result);
    },

    async remove(req: Request, res: Response) {
      const id = req.params.id as string;
      await userService.deactivate(id);
      noContent(res);
    },
  };
}
