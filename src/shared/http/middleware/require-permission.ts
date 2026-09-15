import type { RequestHandler } from 'express';
import type { CachePort } from '../../application/ports/cache-port.js';
import { UnauthorizedError, ForbiddenError } from '../../domain/errors.js';

let cacheInstance: CachePort | null = null;

export function setPermissionCache(cache: CachePort): void {
  cacheInstance = cache;
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
      const permissions = await cacheInstance.get<string[]>(cacheKey);

      if (!permissions) {
        next(new ForbiddenError('Permission denied.'));
        return;
      }

      if (!permissions.includes(permission)) {
        next(new ForbiddenError('Permission denied.'));
        return;
      }

      next();
    } catch {
      next(new ForbiddenError('Permission denied.'));
    }
  };
}
