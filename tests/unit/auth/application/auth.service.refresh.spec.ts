import crypto from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  AuthService,
  type AuthServiceConfig,
} from '../../../../src/modules/auth/application/auth.service.js';
import type { UserRepository } from '../../../../src/modules/auth/application/auth.repository.js';
import type { RefreshTokenRepository } from '../../../../src/modules/auth/application/refresh-token.repository.js';
import type { GrantRepository } from '../../../../src/modules/auth/application/grant.repository.js';
import {
  RefreshToken,
  type RefreshTokenProps,
} from '../../../../src/modules/auth/domain/refresh-token.js';
import { User, type UserProps } from '../../../../src/modules/auth/domain/user.js';
import { InvalidRefreshTokenError } from '../../../../src/modules/auth/domain/errors.js';
import type { CachePort } from '../../../../src/shared/application/ports/cache-port.js';

const RAW_TOKEN = 'raw-refresh-token-value';
const TOKEN_HASH = crypto.createHash('sha256').update(RAW_TOKEN).digest('hex');
const USER_ID = 'e2f0d1cb-3a3a-4f9d-9c9e-6d0f1d8b2a11';

function makeUser(overrides: Partial<UserProps> = {}): User {
  return User.reconstitute({
    id: USER_ID,
    email: 'unit@test.example.com',
    displayName: 'Unit User',
    passwordHash: 'hash',
    roleId: 'role-1',
    roleName: 'User',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

function makeStoredToken(overrides: Partial<RefreshTokenProps> = {}): RefreshToken {
  return RefreshToken.reconstitute({
    id: 'rt-1',
    tokenHash: TOKEN_HASH,
    userId: USER_ID,
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    replacedByTokenHash: null,
    createdByIp: null,
    createdAt: new Date(),
    ...overrides,
  });
}

function makeUserRepo(user: User | null): UserRepository {
  return {
    findByEmail: vi.fn(async () => null),
    findById: vi.fn(async () => user),
    create: vi.fn(async (u: User) => u),
    update: vi.fn(async (u: User) => u),
    list: vi.fn(async () => []),
    count: vi.fn(async () => 0),
    listPaginated: vi.fn(async () => ({ items: [], total: 0 })),
    findRoleByName: vi.fn(async () => null),
    updateRoleId: vi.fn(async () => {}),
    findByRoleId: vi.fn(async () => []),
  };
}

function makeRefreshTokenRepo(stored: RefreshToken | null) {
  return {
    findByTokenHash: vi.fn(async () => stored),
    create: vi.fn(async (token: RefreshToken) => token),
    revoke: vi.fn(async (_tokenHash: string, _replacedByHash?: string) => {}),
    revokeAllActiveByUserId: vi.fn(async (_userId: string) => {}),
    deleteByUserId: vi.fn(async (_userId: string) => {}),
    deleteExpired: vi.fn(async (_now: Date) => {}),
  } satisfies RefreshTokenRepository;
}

function makeGrantRepo(): GrantRepository {
  return {
    findByUserAndPermission: vi.fn(async () => null),
    findActiveByUser: vi.fn(async () => []),
    create: vi.fn(async (grant: Parameters<GrantRepository['create']>[0]) => grant),
    delete: vi.fn(async (_userId: string, _permissionName: string) => {}),
    deleteByUserId: vi.fn(async (_userId: string) => {}),
  };
}

function makeCache(): CachePort {
  const store = new Map<string, unknown>();
  return {
    async get<T>(key: string): Promise<T | null> {
      return (store.get(key) as T) ?? null;
    },
    async set<T>(key: string, value: T): Promise<void> {
      store.set(key, value);
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
    async close(): Promise<void> {
      store.clear();
    },
  };
}

function makeConfig(graceSeconds: number): AuthServiceConfig {
  return {
    JWT_SECRET: 'test-secret-value-0123456789abcdef',
    JWT_ISSUER: 'EventNest.AuthService',
    JWT_AUDIENCE: 'EventNest',
    JWT_ACCESS_EXPIRY_MINUTES: 60,
    JWT_REFRESH_EXPIRY_DAYS: 30,
    REFRESH_ROTATION_GRACE_SECONDS: graceSeconds,
  };
}

function buildService(
  stored: RefreshToken | null,
  graceSeconds: number,
  user: User | null = makeUser(),
) {
  const users = makeUserRepo(user);
  const refreshTokens = makeRefreshTokenRepo(stored);
  const service = new AuthService(
    users,
    refreshTokens,
    makeGrantRepo(),
    makeCache(),
    makeConfig(graceSeconds),
  );
  return { service, users, refreshTokens };
}

describe('AuthService.refresh — token validation', () => {
  it('rejects a missing token', async () => {
    const { service, refreshTokens } = buildService(null, 30);

    await expect(service.refresh(null)).rejects.toThrow(InvalidRefreshTokenError);
    expect(refreshTokens.findByTokenHash).not.toHaveBeenCalled();
  });

  it('rejects an unknown token', async () => {
    const { service } = buildService(null, 30);

    await expect(service.refresh(RAW_TOKEN)).rejects.toThrow(InvalidRefreshTokenError);
  });

  it('rejects an expired token', async () => {
    const { service } = buildService(
      makeStoredToken({ expiresAt: new Date(Date.now() - 1000) }),
      30,
    );

    await expect(service.refresh(RAW_TOKEN)).rejects.toThrow(InvalidRefreshTokenError);
  });

  it('rejects a deactivated user', async () => {
    const { service } = buildService(makeStoredToken(), 30, makeUser({ isActive: false }));

    await expect(service.refresh(RAW_TOKEN)).rejects.toThrow(InvalidRefreshTokenError);
  });
});

describe('AuthService.refresh — rotation', () => {
  it('rotates a valid token: revokes the old hash with the replacement and stores the new row', async () => {
    const { service, refreshTokens } = buildService(makeStoredToken(), 30);

    const result = await service.refresh(RAW_TOKEN);

    expect(refreshTokens.revoke).toHaveBeenCalledTimes(1);
    const [revokedHash, replacementHash] = refreshTokens.revoke.mock.calls[0]!;
    expect(revokedHash).toBe(TOKEN_HASH);
    expect(replacementHash).toBe(
      crypto.createHash('sha256').update(result.refreshToken).digest('hex'),
    );
    expect(refreshTokens.create).toHaveBeenCalledTimes(1);
    expect(refreshTokens.revokeAllActiveByUserId).not.toHaveBeenCalled();
    expect(result.body.accessToken).toEqual(expect.any(String));
    expect(result.body.expiresIn).toBe(3600);
  });
});

describe('AuthService.refresh — grace window', () => {
  it('re-exchanges a recently rotated token within the grace window', async () => {
    const stored = makeStoredToken({
      revokedAt: new Date(Date.now() - 5_000),
      replacedByTokenHash: 'replacement-hash',
    });
    const { service, refreshTokens } = buildService(stored, 30);

    const result = await service.refresh(RAW_TOKEN);

    expect(result.body.accessToken).toEqual(expect.any(String));
    expect(refreshTokens.revoke).not.toHaveBeenCalled();
    expect(refreshTokens.revokeAllActiveByUserId).not.toHaveBeenCalled();
  });

  it('does not mutate the old row during a grace re-exchange', async () => {
    const revokedAt = new Date(Date.now() - 5_000);
    const stored = makeStoredToken({ revokedAt, replacedByTokenHash: 'replacement-hash' });
    const { service } = buildService(stored, 30);

    await service.refresh(RAW_TOKEN);

    expect(stored.revokedAt).toEqual(revokedAt);
    expect(stored.replacedByTokenHash).toBe('replacement-hash');
  });

  it('treats a replayed token past the grace window as theft and revokes the family', async () => {
    const stored = makeStoredToken({
      revokedAt: new Date(Date.now() - 60_000),
      replacedByTokenHash: 'replacement-hash',
    });
    const { service, refreshTokens } = buildService(stored, 30);

    await expect(service.refresh(RAW_TOKEN)).rejects.toThrow(InvalidRefreshTokenError);
    expect(refreshTokens.revokeAllActiveByUserId).toHaveBeenCalledWith(USER_ID);
    expect(refreshTokens.create).not.toHaveBeenCalled();
  });

  it('honors a zero-second grace window', async () => {
    const stored = makeStoredToken({
      revokedAt: new Date(),
      replacedByTokenHash: 'replacement-hash',
    });
    const { service, refreshTokens } = buildService(stored, 0);

    await expect(service.refresh(RAW_TOKEN)).rejects.toThrow(InvalidRefreshTokenError);
    expect(refreshTokens.revokeAllActiveByUserId).toHaveBeenCalledWith(USER_ID);
  });
});

describe('AuthService.refresh — logout-revoked tokens', () => {
  it('rejects a logout-revoked token without revoking the family', async () => {
    const stored = makeStoredToken({ revokedAt: new Date(Date.now() - 60_000) });
    const { service, refreshTokens } = buildService(stored, 30);

    await expect(service.refresh(RAW_TOKEN)).rejects.toThrow(InvalidRefreshTokenError);
    expect(refreshTokens.revokeAllActiveByUserId).not.toHaveBeenCalled();
  });
});
