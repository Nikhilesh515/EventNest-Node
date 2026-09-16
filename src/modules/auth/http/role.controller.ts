import type { Request, Response } from 'express';
import type { RoleService } from '../application/role.service.js';
import { ok, noContent } from '../../../shared/http/respond.js';

export function createRoleController(roleService: RoleService) {
  return {
    async list(_req: Request, res: Response) {
      const result = await roleService.list();
      ok(res, result);
    },

    async getById(req: Request, res: Response) {
      const id = req.params.id as string;
      const result = await roleService.getById(id);
      ok(res, result);
    },

    async create(req: Request, res: Response) {
      const body = req.body as {
        name: string;
        displayName: string;
        description?: string;
        permissionNames: string[];
      };
      const result = await roleService.create(body);
      ok(res, result);
    },

    async update(req: Request, res: Response) {
      const id = req.params.id as string;
      const body = req.body as {
        name?: string;
        displayName?: string;
        description?: string;
        permissionNames?: string[];
      };
      const result = await roleService.update(id, body);
      ok(res, result);
    },

    async remove(req: Request, res: Response) {
      const id = req.params.id as string;
      await roleService.delete(id);
      noContent(res);
    },

    async assignUserRole(req: Request, res: Response) {
      const userId = req.params.id as string;
      const { roleId } = req.body as { roleId: string };
      await roleService.assignUserRole(userId, roleId);
      noContent(res);
    },
  };
}
