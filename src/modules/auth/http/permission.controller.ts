import type { Request, Response } from 'express';
import type { PermissionService } from '../application/permission.service.js';
import { ok, noContent } from '../../../shared/http/respond.js';

export function createPermissionController(permissionService: PermissionService) {
  return {
    async getCatalog(_req: Request, res: Response) {
      const result = permissionService.getCatalog();
      ok(res, result);
    },

    async getEffective(req: Request, res: Response) {
      const result = await permissionService.getEffectiveForUser(req.params.userId as string);
      ok(res, result);
    },

    async check(req: Request, res: Response) {
      const { userId, permission } = req.query as { userId: string; permission: string };
      const result = await permissionService.check(userId, permission);
      ok(res, result);
    },

    async grant(req: Request, res: Response) {
      const { userId, permissionName, expiresAt } = req.body;
      const result = await permissionService.grant(
        userId,
        permissionName,
        expiresAt ? new Date(expiresAt) : undefined,
      );
      ok(res, result);
    },

    async revoke(req: Request, res: Response) {
      const { userId, permissionName } = req.body;
      await permissionService.revoke(userId, permissionName);
      noContent(res);
    },
  };
}
