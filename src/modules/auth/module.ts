import type { Knex } from 'knex';
import type { Logger } from 'pino';
import type { AppConfig } from '../../config/env.js';
import type { CachePort } from '../../shared/application/ports/cache-port.js';
import {
  KnexUserRepository,
  KnexRefreshTokenRepository,
  KnexGrantRepository,
  UserLookupAdapter,
  PermissionProviderAdapter,
} from './infrastructure/index.js';
import { AuthService, type AuthServiceConfig } from './application/auth.service.js';
import { UserService } from './application/user.service.js';
import { PermissionService, computeEffectivePermissions } from './application/permission.service.js';
import { createAuthRoutes } from './http/auth.routes.js';
import { createUserRoutes } from './http/user.routes.js';
import { createPermissionRoutes } from './http/permission.routes.js';
import {
  setPermissionCache,
  setPermissionResolver,
} from '../../shared/http/middleware/require-permission.js';

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

  const authServiceConfig: AuthServiceConfig = {
    JWT_SECRET: config.JWT_SECRET,
    JWT_ISSUER: config.JWT_ISSUER,
    JWT_AUDIENCE: config.JWT_AUDIENCE,
    JWT_ACCESS_EXPIRY_MINUTES: config.JWT_ACCESS_EXPIRY_MINUTES,
    JWT_REFRESH_EXPIRY_DAYS: config.JWT_REFRESH_EXPIRY_DAYS,
  };

  const authService = new AuthService(
    userRepo,
    refreshTokenRepo,
    grantRepo,
    cache,
    authServiceConfig,
  );
  const userService = new UserService(userRepo, grantRepo);
  const permissionService = new PermissionService(grantRepo, userRepo, cache);

  const userLookup = new UserLookupAdapter(knex);
  const permissionProvider = new PermissionProviderAdapter(cache, grantRepo, userRepo);

  setPermissionCache(cache);

  setPermissionResolver(async (userId: string) => {
    const user = await userRepo.findById(userId);
    if (!user) return [];
    const grants = await grantRepo.findActiveByUser(userId);
    return computeEffectivePermissions(user.roleName ?? 'User', grants);
  });

  const authRouter = createAuthRoutes(authService);
  const userRouter = createUserRoutes(userService);
  const permissionRouter = createPermissionRoutes(permissionService);

  return {
    services: {
      auth: authService,
      users: userService,
      permissions: permissionService,
    },
    providers: {
      userLookup,
      permissionProvider,
    },
    routers: [authRouter, userRouter, permissionRouter],
  };
}
