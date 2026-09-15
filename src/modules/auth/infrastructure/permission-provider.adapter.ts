import type { CachePort } from '../../../shared/application/ports/cache-port.js';
import {
  basePermissionsForRole,
  type PermissionName,
} from '../../../shared/application/permissions.js';
import type { PermissionProviderPort } from '../application/ports/permission-provider.port.js';
import type { GrantRepository } from '../application/grant.repository.js';
import type { UserRepository } from '../application/auth.repository.js';

const CACHE_TTL_SECONDS = 300;
const CACHE_PREFIX = 'user';

export class PermissionProviderAdapter implements PermissionProviderPort {
  constructor(
    private readonly cache: CachePort,
    private readonly grantRepo: GrantRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async getEffectivePermissions(userId: string): Promise<string[]> {
    const cacheKey = `${CACHE_PREFIX}:${userId}:permissions`;

    const cached = await this.cache.get<string[]>(cacheKey);
    if (cached) return cached;

    const user = await this.userRepo.findById(userId);
    if (!user) return [];

    const base = basePermissionsForRole(user.roleName ?? '');
    const grants = await this.grantRepo.findActiveByUser(userId);

    const granted = new Set<PermissionName>(base);
    for (const grant of grants) {
      if (grant.isGranted) {
        granted.add(grant.permissionName);
      } else {
        granted.delete(grant.permissionName);
      }
    }

    const permissions = [...granted];
    await this.cache.set(cacheKey, permissions, CACHE_TTL_SECONDS);
    return permissions;
  }
}
