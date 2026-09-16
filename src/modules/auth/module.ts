import type { Knex } from 'knex';
import type { Logger } from 'pino';
import type { AppConfig } from '../../config/env.js';
import type { CachePort } from '../../shared/application/ports/cache-port.js';
import {
  KnexUserRepository,
  KnexRefreshTokenRepository,
  KnexGrantRepository,
  KnexRoleRepository,
  UserLookupAdapter,
  PermissionProviderAdapter,
} from './infrastructure/index.js';
import { AuthService, type AuthServiceConfig } from './application/auth.service.js';
import { UserService } from './application/user.service.js';
import { RoleService } from './application/role.service.js';
import { PermissionService } from './application/permission.service.js';
import { createAuthRoutes } from './http/auth.routes.js';
import { createUserRoutes } from './http/user.routes.js';
import { createPermissionRoutes } from './http/permission.routes.js';
import { createRoleRoutes } from './http/role.routes.js';
import {
  setPermissionCache,
  setPermissionResolver,
} from '../../shared/http/middleware/require-permission.js';
import { basePermissionsForRole } from '../../shared/application/permissions.js';

export interface AuthModuleDeps {
  knex: Knex;
  config: AppConfig;
  logger: Logger;
  cache: CachePort;
}

export function buildAuthModule(deps: AuthModuleDeps) {
  const { knex, config, cache } = deps;

  const userRepo = new KnexUserRepository(knex);
  const refreshTokenRepo = new KnexRefreshTokenRepository(knex);
  const grantRepo = new KnexGrantRepository(knex);
  const roleRepo = new KnexRoleRepository(knex);

  const authServiceConfig: AuthServiceConfig = {
    JWT_SECRET: config.JWT_SECRET,
    JWT_ISSUER: config.JWT_ISSUER,
    JWT_AUDIENCE: config.JWT_AUDIENCE,
    JWT_ACCESS_EXPIRY_MINUTES: config.JWT_ACCESS_EXPIRY_MINUTES,
    JWT_REFRESH_EXPIRY_DAYS: config.JWT_REFRESH_EXPIRY_DAYS,
    REFRESH_ROTATION_GRACE_SECONDS: config.REFRESH_ROTATION_GRACE_SECONDS,
  };

  const authService = new AuthService(
    userRepo,
    refreshTokenRepo,
    grantRepo,
    cache,
    authServiceConfig,
  );
  const userService = new UserService(userRepo, grantRepo, roleRepo, cache);
  const roleService = new RoleService(roleRepo, userRepo, cache);
  const permissionService = new PermissionService(grantRepo, userRepo, cache, deps.logger);

  const userLookup = new UserLookupAdapter(knex);
  const permissionProvider = new PermissionProviderAdapter(cache, grantRepo, userRepo);

  setPermissionCache(cache);

  setPermissionResolver(async (userId: string) => {
    const user = await userRepo.findById(userId);
    if (!user) return [];

    const roleName = user.roleName ?? 'User';
    const dbPerms = await roleRepo.getPermissionNames(user.roleId);
    if (dbPerms.length > 0) {
      const grants = await grantRepo.findActiveByUser(userId);
      const extraPerms = grants
        .filter((g) => !g.isExpired(new Date()))
        .map((g) => g.permissionName);
      return [...new Set([...dbPerms, ...extraPerms])];
    }

    const basePerms = basePermissionsForRole(roleName);
    const grants = await grantRepo.findActiveByUser(userId);
    const extraPerms = grants.filter((g) => !g.isExpired(new Date())).map((g) => g.permissionName);
    return [...new Set([...basePerms, ...extraPerms])];
  });

  const cookieSecure = config.COOKIE_SECURE ?? config.NODE_ENV === 'production';
  const authRouter = createAuthRoutes(authService, { ...config, COOKIE_SECURE: cookieSecure });
  const userRouter = createUserRoutes(userService);
  const permissionRouter = createPermissionRoutes(permissionService);
  const roleRouter = createRoleRoutes(roleService);

  return {
    services: {
      auth: authService,
      users: userService,
      roles: roleService,
      permissions: permissionService,
    },
    providers: {
      userLookup,
      permissionProvider,
    },
    routers: [authRouter, userRouter, permissionRouter, roleRouter],
  };
}
