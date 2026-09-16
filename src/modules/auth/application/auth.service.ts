import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

import type { CachePort } from '../../../shared/application/ports/cache-port.js';
import { basePermissionsForRole } from '../../../shared/application/permissions.js';
import type { UserRepository } from './auth.repository.js';
import type { RefreshTokenRepository } from './refresh-token.repository.js';
import type { GrantRepository } from './grant.repository.js';
import { User } from '../domain/user.js';
import { RefreshToken } from '../domain/refresh-token.js';
import {
  EmailAlreadyExistsError,
  InvalidCredentialsError,
  AccountDeactivatedError,
  InvalidRefreshTokenError,
} from '../domain/errors.js';
import type { AuthSessionResult, AuthUserDto } from './dto/auth.dto.js';

const BCRYPT_COST = 12;
const DUMMY_HASH = '$2b$12$' + 'a'.repeat(53);

export interface AuthServiceConfig {
  JWT_SECRET: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  JWT_ACCESS_EXPIRY_MINUTES: number;
  JWT_REFRESH_EXPIRY_DAYS: number;
  REFRESH_ROTATION_GRACE_SECONDS: number;
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly grants: GrantRepository,
    private readonly cache: CachePort,
    private readonly config: AuthServiceConfig,
  ) {}

  async register(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<AuthSessionResult> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      throw new EmailAlreadyExistsError(input.email);
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

    const role = await this.users.findRoleByName('User');
    if (!role) {
      throw new Error("Default 'User' role not found in database.");
    }

    const user = User.create(input.email, input.displayName, passwordHash, role.id, role.name);
    await this.users.create(user);

    const accessToken = this.generateAccessToken(user);
    const { refreshToken, tokenHash, expiresAt } = this.generateRefreshToken();
    const rt = RefreshToken.create(user.id, tokenHash, expiresAt);
    await this.refreshTokens.create(rt);

    await this.writePermissionCache(user.id);

    return {
      body: {
        accessToken,
        expiresIn: this.config.JWT_ACCESS_EXPIRY_MINUTES * 60,
        user: this.toAuthUserDto(user),
      },
      refreshToken,
    };
  }

  async login(input: { email: string; password: string }): Promise<AuthSessionResult> {
    const user = await this.users.findByEmail(input.email);

    if (!user) {
      await bcrypt.compare(input.password, DUMMY_HASH);
      throw new InvalidCredentialsError();
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new InvalidCredentialsError();
    }

    if (!user.isActive) {
      throw new AccountDeactivatedError();
    }

    const accessToken = this.generateAccessToken(user);
    const { refreshToken, tokenHash, expiresAt } = this.generateRefreshToken();
    const rt = RefreshToken.create(user.id, tokenHash, expiresAt);
    await this.refreshTokens.create(rt);

    await this.writePermissionCache(user.id);

    return {
      body: {
        accessToken,
        expiresIn: this.config.JWT_ACCESS_EXPIRY_MINUTES * 60,
        user: this.toAuthUserDto(user),
      },
      refreshToken,
    };
  }

  async refresh(refreshToken: string | null): Promise<AuthSessionResult> {
    if (!refreshToken) {
      throw new InvalidRefreshTokenError();
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.refreshTokens.findByTokenHash(tokenHash);
    const now = new Date();

    if (!stored || stored.isExpired(now)) {
      throw new InvalidRefreshTokenError();
    }

    if (stored.isRevoked) {
      const rotatedRecently =
        stored.replacedByTokenHash !== null &&
        stored.revokedAt !== null &&
        now.getTime() - stored.revokedAt.getTime() <
          this.config.REFRESH_ROTATION_GRACE_SECONDS * 1000;

      if (!rotatedRecently) {
        if (stored.replacedByTokenHash !== null) {
          await this.refreshTokens.revokeAllActiveByUserId(stored.userId);
        }
        throw new InvalidRefreshTokenError();
      }
    }

    const user = await this.users.findById(stored.userId);
    if (!user || !user.isActive) {
      throw new InvalidRefreshTokenError();
    }

    const {
      refreshToken: newRefreshToken,
      tokenHash: newHash,
      expiresAt,
    } = this.generateRefreshToken();

    if (!stored.isRevoked) {
      await this.refreshTokens.revoke(tokenHash, newHash);
    }

    const newRt = RefreshToken.create(user.id, newHash, expiresAt);
    await this.refreshTokens.create(newRt);

    const accessToken = this.generateAccessToken(user);
    await this.writePermissionCache(user.id);

    return {
      body: {
        accessToken,
        expiresIn: this.config.JWT_ACCESS_EXPIRY_MINUTES * 60,
        user: this.toAuthUserDto(user),
      },
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshToken: string | null): Promise<void> {
    if (!refreshToken) {
      return;
    }
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.refreshTokens.findByTokenHash(tokenHash);
    if (stored && !stored.isRevoked) {
      await this.refreshTokens.revoke(tokenHash);
    }
  }

  private generateAccessToken(user: {
    id: string;
    email: string;
    displayName: string;
    roleName: string | null;
  }): string {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.displayName,
      role: user.roleName ?? 'User',
      jti: crypto.randomUUID(),
    };

    return jwt.sign(payload, this.config.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: `${this.config.JWT_ACCESS_EXPIRY_MINUTES}m`,
      issuer: this.config.JWT_ISSUER,
      audience: this.config.JWT_AUDIENCE,
    });
  }

  private generateRefreshToken(): {
    refreshToken: string;
    tokenHash: string;
    expiresAt: Date;
  } {
    const refreshToken = crypto.randomBytes(64).toString('base64url');
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(
      Date.now() + this.config.JWT_REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );
    return { refreshToken, tokenHash, expiresAt };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async writePermissionCache(userId: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) return;

    const roleName = user.roleName ?? 'User';
    const basePerms = basePermissionsForRole(roleName);

    const grants = await this.grants.findActiveByUser(userId);
    const now = new Date();
    const extraPerms = grants.filter((g) => !g.isExpired(now)).map((g) => g.permissionName);

    const allPerms = [...new Set([...basePerms, ...extraPerms])];
    await this.cache.set(`user:${userId}:permissions`, allPerms, 300);
  }

  private toAuthUserDto(user: {
    id: string;
    email: string;
    displayName: string;
    roleName: string | null;
    isActive: boolean;
  }): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roleName: user.roleName ?? 'User',
      isActive: user.isActive,
    };
  }
}
