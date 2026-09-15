import type { Knex } from 'knex';
import type { UserLookupPort, UserSummary } from '../application/ports/user-lookup.port.js';

export class UserLookupAdapter implements UserLookupPort {
  constructor(private readonly knex: Knex) {}

  async getUser(id: string): Promise<UserSummary | null> {
    const row = await this.knex('users')
      .join('roles', 'users.role_id', 'roles.id')
      .select(
        'users.id',
        'users.email',
        'users.display_name',
        'roles.name as role_name',
        'users.is_active',
      )
      .where('users.id', id)
      .first();
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      roleName: row.role_name,
      isActive: row.is_active,
    };
  }

  async getDisplayNames(ids: string[]): Promise<Record<string, string>> {
    if (ids.length === 0) return {};
    const rows = await this.knex('users').select('id', 'display_name').whereIn('id', ids);
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.id] = row.display_name;
    }
    return result;
  }
}
