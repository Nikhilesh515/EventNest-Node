import type { Knex } from 'knex';
import type { GrantRepository } from '../application/grant.repository.js';
import { PermissionGrant } from '../domain/permission-grant.js';
import type { PermissionGrantProps } from '../domain/permission-grant.js';
import type { PermissionName } from '../../../shared/application/permissions.js';

interface GrantRow {
  id: string;
  user_id: string;
  permission_name: string;
  is_granted: boolean;
  expires_at: Date | null;
  created_at: Date;
}

function rowToProps(row: GrantRow): PermissionGrantProps {
  return {
    id: row.id,
    userId: row.user_id,
    permissionName: row.permission_name as PermissionName,
    isGranted: row.is_granted,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

function hydrateGrant(row: GrantRow): PermissionGrant {
  return new (
    PermissionGrant as unknown as {
      new (props: PermissionGrantProps): PermissionGrant;
    }
  )(rowToProps(row));
}

export class KnexGrantRepository implements GrantRepository {
  constructor(private readonly knex: Knex) {}

  async findByUserAndPermission(
    userId: string,
    permissionName: string,
  ): Promise<PermissionGrant | null> {
    const row = await this.knex('permission_grants')
      .where({ user_id: userId, permission_name: permissionName })
      .first();
    return row ? hydrateGrant(row) : null;
  }

  async findActiveByUser(userId: string): Promise<PermissionGrant[]> {
    const rows = await this.knex('permission_grants')
      .where('user_id', userId)
      .where(function () {
        this.whereNull('expires_at').orWhere('expires_at', '>', new Date());
      });
    return rows.map(hydrateGrant);
  }

  async create(grant: PermissionGrant): Promise<PermissionGrant> {
    const [row] = await this.knex('permission_grants')
      .insert({
        id: grant.id,
        user_id: grant.userId,
        permission_name: grant.permissionName,
        is_granted: grant.isGranted,
        expires_at: grant.expiresAt,
        created_at: grant.createdAt,
      })
      .returning('*');
    return hydrateGrant(row);
  }

  async delete(userId: string, permissionName: string): Promise<void> {
    await this.knex('permission_grants')
      .where({ user_id: userId, permission_name: permissionName })
      .del();
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.knex('permission_grants').where('user_id', userId).del();
  }
}
