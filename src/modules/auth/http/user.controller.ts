import type { Request, Response } from 'express';
import type { UserService } from '../application/user.service.js';
import { ok, noContent } from '../../../shared/http/respond.js';

export function createUserController(userService: UserService) {
  return {
    async getMe(req: Request, res: Response) {
      const result = await userService.getMe(req.user!.id);
      ok(res, result);
    },

    async getById(req: Request, res: Response) {
      const result = await userService.getById(req.params.id as string);
      ok(res, result);
    },

    async list(req: Request, res: Response) {
      const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
      const result = await userService.list(page, pageSize);
      ok(res, result);
    },

    async update(req: Request, res: Response) {
      const result = await userService.update(req.params.id as string, req.body);
      ok(res, result);
    },

    async remove(req: Request, res: Response) {
      await userService.deactivate(req.params.id as string);
      noContent(res);
    },
  };
}
