import type { Request, Response } from 'express';
import type { UserService } from '../application/user.service.js';
import { ok, created, noContent } from '../../../shared/http/respond.js';
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
      const { page, pageSize, search, role } = req.query;
      const result = await userService.listPaginated({
        ...(page !== undefined && { page: Number(page) }),
        ...(pageSize !== undefined && { pageSize: Number(pageSize) }),
        ...(search !== undefined && { search: search as string }),
        ...(role !== undefined && { role: role as string }),
      });
      ok(res, result);
    },

    async createByAdmin(req: Request, res: Response) {
      const result = await userService.createByAdmin(req.body);
      created(res, result, `/api/users/${result.id}`);
    },

    async update(req: Request, res: Response) {
      const id = req.params.id as string;
      const body = req.body as { displayName?: string };
      const result = await userService.update(
        id,
        body.displayName !== undefined ? { displayName: body.displayName } : {},
      );
      ok(res, result);
    },

    async remove(req: Request, res: Response) {
      const id = req.params.id as string;
      await userService.deactivate(id);
      noContent(res);
    },
  };
}
