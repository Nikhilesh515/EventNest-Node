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

export class PermissionService {
  constructor(
    private readonly grants: GrantRepository,
    private readonly users: UserRepository,
    private readonly cache: CachePort,
  ) {}

  getCatalog(): PermissionDto[] {
    return PERMISSION_CATALOG.map((entry) => ({
      name: entry.name,
      displayName: entry.displayName,
      group: entry.group,
      isGranted: false,
    }));
  }

  async getEffectiveForUser(userId: string): Promise<PermissionDto[]> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundError(`User '${userId}' not found.`);
    }

    const roleName = user.roleName ?? 'User';
    const basePerms = basePermissionsForRole(roleName);
    const grants = await this.grants.findActiveByUser(userId);
    const now = new Date();
    const extraPerms = grants.filter((g) => !g.isExpired(now)).map((g) => g.permissionName);

    const grantedSet = new Set<string>([...basePerms, ...extraPerms]);

    return PERMISSION_CATALOG.map((entry) => ({
      name: entry.name,
      displayName: entry.displayName,
      group: entry.group,
      isGranted: grantedSet.has(entry.name),
    }));
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
    await this.cache.delete(`user:${userId}:permissions`);
  }
}
