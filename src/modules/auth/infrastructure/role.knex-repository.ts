import type { Knex } from 'knex';
import type { RoleRepository } from '../application/role.repository.js';
import { Role, type RoleRow } from '../domain/role.js';

export class KnexRoleRepository implements RoleRepository {
  constructor(private readonly knex: Knex) {}

  async findAll(): Promise<Role[]> {
    const rows = await this.knex('roles').orderBy('sort_order');
    return rows.map((r: RoleRow) => Role.fromRow(r));
  }

  async findById(id: string): Promise<Role | null> {
    const row: RoleRow | undefined = await this.knex('roles').where({ id }).first();
    return row ? Role.fromRow(row) : null;
  }

  async findByName(name: string): Promise<Role | null> {
    const row: RoleRow | undefined = await this.knex('roles')
      .whereRaw('LOWER(name) = LOWER(?)', [name])
      .first();
    return row ? Role.fromRow(row) : null;
  }

  async create(role: Role): Promise<Role> {
    await this.knex('roles').insert(role.toRow());
    return role;
  }

  async update(role: Role): Promise<Role> {
    await this.knex('roles').where({ id: role.id }).update(role.toRow());
    return role;
  }

  async delete(id: string): Promise<void> {
    await this.knex('roles').where({ id }).delete();
  }

  async countUsersByRole(roleId: string): Promise<number> {
    const result = (await this.knex('users').where({ role_id: roleId }).count('id as cnt').first()) as
      | { cnt: string | number }
      | undefined;
    return Number(result?.cnt ?? 0);
  }

  async getPermissionNames(roleId: string): Promise<string[]> {
    const rows = await this.knex('role_permissions').where({ role_id: roleId }).select('permission_name');
    return rows.map((r: { permission_name: string }) => r.permission_name);
  }

  async setPermissionNames(roleId: string, permissionNames: string[]): Promise<void> {
    await this.knex('role_permissions').where({ role_id: roleId }).delete();
    if (permissionNames.length > 0) {
      await this.knex('role_permissions').insert(
        permissionNames.map((pn) => ({ role_id: roleId, permission_name: pn })),
      );
    }
  }
}
