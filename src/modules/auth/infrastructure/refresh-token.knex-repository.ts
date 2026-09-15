import type { Knex } from 'knex';
import type { RefreshTokenRepository } from '../application/refresh-token.repository.js';
import { RefreshToken } from '../domain/refresh-token.js';
import type { RefreshTokenProps } from '../domain/refresh-token.js';

interface RefreshTokenRow {
  id: string;
  token_hash: string;
  user_id: string;
  expires_at: Date;
  revoked_at: Date | null;
  replaced_by_token_hash: string | null;
  created_by_ip: string | null;
  created_at: Date;
}

function rowToProps(row: RefreshTokenRow): RefreshTokenProps {
  return {
    id: row.id,
    tokenHash: row.token_hash,
    userId: row.user_id,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    replacedByTokenHash: row.replaced_by_token_hash,
    createdByIp: row.created_by_ip,
    createdAt: row.created_at,
  };
}

function hydrateRefreshToken(row: RefreshTokenRow): RefreshToken {
  return new (RefreshToken as unknown as { new (props: RefreshTokenProps): RefreshToken })(
    rowToProps(row),
  );
}

export class KnexRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly knex: Knex) {}

  async findByTokenHash(hash: string): Promise<RefreshToken | null> {
    const row = await this.knex('refresh_tokens').where('token_hash', hash).first();
    return row ? hydrateRefreshToken(row) : null;
  }

  async create(token: RefreshToken): Promise<RefreshToken> {
    const [row] = await this.knex('refresh_tokens')
      .insert({
        id: token.id,
        token_hash: token.tokenHash,
        user_id: token.userId,
        expires_at: token.expiresAt,
        revoked_at: token.revokedAt,
        replaced_by_token_hash: token.replacedByTokenHash,
        created_by_ip: token.createdByIp,
        created_at: token.createdAt,
      })
      .returning('*');
    return hydrateRefreshToken(row);
  }

  async revoke(tokenHash: string, replacedByHash?: string): Promise<void> {
    await this.knex('refresh_tokens')
      .where('token_hash', tokenHash)
      .update({
        revoked_at: this.knex.fn.now(),
        replaced_by_token_hash: replacedByHash ?? null,
      });
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.knex('refresh_tokens').where('user_id', userId).del();
  }

  async deleteExpired(now: Date): Promise<void> {
    await this.knex('refresh_tokens').where('expires_at', '<', now).del();
  }
}
