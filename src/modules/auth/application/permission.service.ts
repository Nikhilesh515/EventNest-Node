import type { Logger } from 'pino';
import type { CachePort } from '../../../shared/application/ports/cache-port.js';
import {
  PERMISSION_CATALOG,
  basePermissionsForRole,
  isPermissionName,
} from '../../../shared/application/permissions.js';
import type { PermissionName } from '../../../shared/application/permissions.js';
import type { GrantRepository } from './grant.repository.js';
import type { UserRepository } from './auth.repository.js';
import { PermissionGrant } from '../domain/permission-grant.js';
import {
  UnknownPermissionError,
  PermissionAlreadyGrantedError,
  PermissionNotGrantedError,
} from '../domain/errors.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { PermissionDto } from './dto/permission.dto.js';

export function computeEffectivePermissions(
  roleName: string,
  grants: Array<{ permissionName: string; isExpired: (now: Date) => boolean }>,
): string[] {
  const basePerms = basePermissionsForRole(roleName);
  const now = new Date();
  const extraPerms = grants.filter((g) => !g.isExpired(now)).map((g) => g.permissionName);
  return [...new Set([...basePerms, ...extraPerms])];
}

export class PermissionService {
  constructor(
    private readonly grants: GrantRepository,
    private readonly users: UserRepository,
    private readonly cache: CachePort,
    private readonly logger?: Logger,
  ) {}

  getCatalog(): PermissionDto[] {
    return PERMISSION_CATALOG.map((entry) => ({
      name: entry.name,
      displayName: entry.displayName,
      group: entry.group,
      isGranted: false,
      source: 'none',
    }));
  }

  async getEffectiveForUser(userId: string): Promise<PermissionDto[]> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundError(`User '${userId}' not found.`);
    }

    const roleName = user.roleName ?? 'User';
    const grants = await this.grants.findActiveByUser(userId);
    const directGrants = new Set<string>(
      grants.filter((g) => !g.isExpired(new Date())).map((g) => g.permissionName),
    );
    const effectivePerms = computeEffectivePermissions(roleName, grants);
    const grantedSet = new Set<string>(effectivePerms);

    return PERMISSION_CATALOG.map((entry) => {
      let source: PermissionDto['source'] = 'none';
      if (grantedSet.has(entry.name)) {
        source = directGrants.has(entry.name) ? 'direct-grant' : 'role-default';
      }
      return {
        name: entry.name,
        displayName: entry.displayName,
        group: entry.group,
        isGranted: grantedSet.has(entry.name),
        source,
      };
    });
  }

  async grant(userId: string, permissionName: string, expiresAt?: Date): Promise<PermissionDto> {
    if (!isPermissionName(permissionName)) {
      throw new UnknownPermissionError(permissionName);
    }

    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundError(`User '${userId}' not found.`);
    }

    const roleName = user.roleName ?? 'User';
    const basePerms = basePermissionsForRole(roleName);
    if (basePerms.includes(permissionName as PermissionName)) {
      throw new PermissionAlreadyGrantedError(permissionName, userId);
    }

    const existing = await this.grants.findByUserAndPermission(userId, permissionName);
    if (existing) {
      throw new PermissionAlreadyGrantedError(permissionName, userId);
    }

    const grant = PermissionGrant.create(userId, permissionName as PermissionName, expiresAt);
    await this.grants.create(grant);

    await this.invalidateCache(userId);

    const entry = PERMISSION_CATALOG.find((e) => e.name === permissionName)!;
    return {
      name: entry.name,
      displayName: entry.displayName,
      group: entry.group,
      isGranted: true,
      source: 'direct-grant',
    };
  }

  async revoke(userId: string, permissionName: string): Promise<void> {
    if (!isPermissionName(permissionName)) {
      throw new UnknownPermissionError(permissionName);
    }

    const existing = await this.grants.findByUserAndPermission(userId, permissionName);
    if (!existing) {
      throw new PermissionNotGrantedError(permissionName, userId);
    }

    await this.grants.delete(userId, permissionName);
    await this.invalidateCache(userId);
  }

  async check(userId: string, permissionName: string): Promise<boolean> {
    if (!isPermissionName(permissionName)) {
      return false;
    }

    const user = await this.users.findById(userId);
    if (!user || !user.isActive) {
      return false;
    }

    const roleName = user.roleName ?? 'User';
    const basePerms = basePermissionsForRole(roleName);
    if (basePerms.includes(permissionName as PermissionName)) {
      return true;
    }

    const grants = await this.grants.findActiveByUser(userId);
    const now = new Date();
    return grants.some((g) => g.permissionName === permissionName && !g.isExpired(now));
  }

  private async invalidateCache(userId: string): Promise<void> {
    try {
      await this.cache.delete(`user:${userId}:permissions`);
    } catch (error) {
      this.logger?.warn({ error, userId }, 'Failed to invalidate permission cache');
    }
  }
}
