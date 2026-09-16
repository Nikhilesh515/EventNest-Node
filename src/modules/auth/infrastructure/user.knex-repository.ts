import type { Knex } from 'knex';
import type { UserRepository } from '../application/auth.repository.js';
import { User } from '../domain/user.js';
import type { UserProps } from '../domain/user.js';

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  role_id: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  role_name: string;
}

function rowToProps(row: UserRow): UserProps {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    roleId: row.role_id,
    roleName: row.role_name,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function hydrateUser(row: UserRow): User {
  return User.reconstitute(rowToProps(row));
}

const USER_COLUMNS = [
  'users.id',
  'users.email',
  'users.display_name',
  'users.password_hash',
  'users.role_id',
  'users.is_active',
  'users.created_at',
  'users.updated_at',
  'roles.name as role_name',
] as const;

export class KnexUserRepository implements UserRepository {
  constructor(private readonly knex: Knex) {}

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.knex('users')
      .join('roles', 'users.role_id', 'roles.id')
      .select(...USER_COLUMNS)
      .where('users.email', email)
      .first();
    return row ? hydrateUser(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.knex('users')
      .join('roles', 'users.role_id', 'roles.id')
      .select(...USER_COLUMNS)
      .where('users.id', id)
      .first();
    return row ? hydrateUser(row) : null;
  }

  async create(user: User): Promise<User> {
    const [row] = await this.knex('users')
      .insert({
        id: user.id,
        email: user.email,
        display_name: user.displayName,
        password_hash: user.passwordHash,
        role_id: user.roleId,
        is_active: user.isActive,
        created_at: user.createdAt,
        updated_at: user.updatedAt,
      })
      .returning('*');

    const role = await this.knex('roles').where('id', row.role_id).first();
    return hydrateUser({ ...row, role_name: role?.name ?? '' });
  }

  async update(user: User): Promise<User> {
    const [row] = await this.knex('users')
      .where('id', user.id)
      .update({
        display_name: user.displayName,
        is_active: user.isActive,
        updated_at: new Date(),
      })
      .returning('*');

    const role = await this.knex('roles').where('id', row.role_id).first();
    return hydrateUser({ ...row, role_name: role?.name ?? '' });
  }

  async list(page: number, pageSize: number): Promise<User[]> {
    const offset = (page - 1) * pageSize;
    const rows = await this.knex('users')
      .join('roles', 'users.role_id', 'roles.id')
      .where('users.is_active', true)
      .select(...USER_COLUMNS)
      .orderBy('users.created_at', 'desc')
      .limit(pageSize)
      .offset(offset);
    return rows.map(hydrateUser);
  }

  async count(): Promise<number> {
    const result = (await this.knex('users').count('* as count').first()) as
      { count: string | number } | undefined;
    return Number(result?.count ?? 0);
  }

  async findRoleByName(name: string): Promise<{ id: string; name: string } | null> {
    const row = await this.knex('roles').where('name', name).first();
    return row ? { id: row.id, name: row.name } : null;
  }

  async updateRoleId(userId: string, roleId: string): Promise<void> {
    await this.knex('users').where({ id: userId }).update({ role_id: roleId, updated_at: new Date() });
  }

  async findByRoleId(roleId: string): Promise<User[]> {
    const rows = await this.knex('users')
      .join('roles', 'users.role_id', 'roles.id')
      .where('users.role_id', roleId)
      .where('users.is_active', true)
      .select(...USER_COLUMNS);
    return rows.map(hydrateUser);
  }

  async listPaginated(query: {
    page: number;
    pageSize: number;
    search?: string;
    role?: string;
  }): Promise<{ items: User[]; total: number }> {
    const { page, pageSize, search, role } = query;

    const baseQuery = this.knex('users')
      .join('roles', 'users.role_id', 'roles.id')
      .where('users.is_active', true);

    if (search) {
      const term = `%${search.toLowerCase()}%`;
      baseQuery.where(function () {
        this.whereRaw('LOWER(users.email) LIKE ?', [term]).orWhereRaw(
          'LOWER(users.display_name) LIKE ?',
          [term],
        );
      });
    }

    if (role) {
      baseQuery.where('users.role_id', role);
    }

    const countResult = await baseQuery.clone().clearSelect().count('users.id as cnt').first();
    const total = Number((countResult as { cnt: string | number } | undefined)?.cnt ?? 0);

    const offset = (page - 1) * pageSize;
    const rows = await baseQuery
      .select(...USER_COLUMNS)
      .orderBy('users.created_at', 'desc')
      .limit(pageSize)
      .offset(offset);

    return { items: rows.map(hydrateUser), total };
  }
}
