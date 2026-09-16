import bcrypt from 'bcrypt';
import { User } from '../domain/user.js';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from '../../../shared/domain/errors.js';
import type { UserRepository } from './auth.repository.js';
import type { GrantRepository } from './grant.repository.js';
import type { RoleRepository } from './role.repository.js';
import type { CachePort } from '../../../shared/application/ports/cache-port.js';
import type { UserDto } from './dto/user.dto.js';

export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly grants: GrantRepository,
    private readonly roles: RoleRepository,
    private readonly cache: CachePort,
  ) {}

  async getMe(userId: string): Promise<UserDto> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundError(`User '${userId}' not found.`);
    }
    return this.toDto(user);
  }

  async getById(id: string): Promise<UserDto> {
    const user = await this.users.findById(id);
    if (!user || !user.isActive) {
      throw new NotFoundError(`User '${id}' not found.`);
    }
    return this.toDto(user);
  }

  async list(page: number, pageSize: number): Promise<UserDto[]> {
    const users = await this.users.list(page, pageSize);
    return users.filter((u) => u.isActive).map((u) => this.toDto(u));
  }

  async listPaginated(query: {
    page?: number;
    pageSize?: number;
    search?: string;
    role?: string;
  }): Promise<{
    items: UserDto[];
    total: number;
    page: number;
    pageSize: number;
    pages: number;
  }> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    const { items, total } = await this.users.listPaginated({
      page,
      pageSize,
      ...(query.search !== undefined && { search: query.search }),
      ...(query.role !== undefined && { role: query.role }),
    });

    return {
      items: items.map((u) => this.toDto(u)),
      total,
      page,
      pageSize,
      pages: Math.ceil(total / pageSize),
    };
  }

  async createByAdmin(input: {
    email: string;
    displayName: string;
    password: string;
    roleId: string;
  }): Promise<UserDto> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      throw new ConflictError(`User with email '${input.email}' already exists.`);
    }

    if (input.password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters.', {
        password: ['Password must be at least 8 characters.'],
      });
    }

    const role = await this.roles.findById(input.roleId);
    if (!role) {
      throw new NotFoundError(`Role '${input.roleId}' not found.`);
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = User.create(input.email, input.displayName, passwordHash, input.roleId, role.name);
    await this.users.create(user);

    return this.toDto(user);
  }

  async update(id: string, input: { displayName?: string }): Promise<UserDto> {
    const user = await this.users.findById(id);
    if (!user) {
      throw new NotFoundError(`User '${id}' not found.`);
    }

    if (input.displayName !== undefined) {
      user.updateProfile(input.displayName);
    }

    await this.users.update(user);
    return this.toDto(user);
  }

  async deactivate(id: string): Promise<void> {
    const user = await this.users.findById(id);
    if (!user) {
      throw new NotFoundError(`User '${id}' not found.`);
    }

    user.deactivate();
    await this.users.update(user);
    await this.grants.deleteByUserId(id);
    await this.cache.delete(`user:${id}:permissions`);
  }

  private toDto(user: {
    id: string;
    email: string;
    displayName: string;
    roleId: string;
    roleName: string | null;
    isActive: boolean;
  }): UserDto {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roleId: user.roleId,
      roleName: user.roleName ?? 'User',
      isActive: user.isActive,
    };
  }
}
