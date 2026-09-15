import type { RequestHandler } from 'express';
import type { CachePort } from '../../application/ports/cache-port.js';
import { UnauthorizedError, ForbiddenError } from '../../domain/errors.js';
import { UnexpectedError } from '../../domain/errors.js';

let cacheInstance: CachePort | null = null;
let resolvePermissions: ((userId: string) => Promise<string[]>) | null = null;

export function setPermissionCache(cache: CachePort): void {
  cacheInstance = cache;
}

export function setPermissionResolver(resolver: (userId: string) => Promise<string[]>): void {
  resolvePermissions = resolver;
}

export function requirePermission(permission: string): RequestHandler {
  return async (req, _res, next) => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication is required.'));
      return;
    }

    if (!cacheInstance) {
      next(new ForbiddenError('Permission denied.'));
      return;
    }

    const cacheKey = `user:${req.user.id}:permissions`;

    try {
      let permissions = await cacheInstance.get<string[]>(cacheKey);

      if (!permissions && resolvePermissions) {
        permissions = await resolvePermissions(req.user.id);
        await cacheInstance.set(cacheKey, permissions, 300);
      }

      if (!permissions || !permissions.includes(permission)) {
        next(new ForbiddenError('Permission denied.'));
        return;
      }

      next();
    } catch (err) {
      if (err instanceof ForbiddenError || err instanceof UnauthorizedError) {
        next(err);
      } else {
        next(new UnexpectedError('Permission check failed.'));
      }
    }
  };
}
