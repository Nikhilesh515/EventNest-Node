import type { RefreshToken } from '../domain/refresh-token.js';

export interface RefreshTokenRepository {
  findByTokenHash(hash: string): Promise<RefreshToken | null>;
  create(token: RefreshToken): Promise<RefreshToken>;
  revoke(tokenHash: string, replacedByHash?: string): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
  deleteExpired(now: Date): Promise<void>;
}
