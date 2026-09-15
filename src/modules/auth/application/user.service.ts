import { NotFoundError } from '../../../shared/domain/errors.js';
import type { UserRepository } from './auth.repository.js';
import type { GrantRepository } from './grant.repository.js';
import type { UserDto } from './dto/user.dto.js';

export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly grants: GrantRepository,
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

  async list(page: number, pageSize: number): Promise<{ users: UserDto[]; total: number }> {
    const [users, total] = await Promise.all([this.users.list(page, pageSize), this.users.count()]);
    return {
      users: users.filter((u) => u.isActive).map((u) => this.toDto(u)),
      total,
    };
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
  }

  private toDto(user: {
    id: string;
    email: string;
    displayName: string;
    roleName: string | null;
    isActive: boolean;
  }): UserDto {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roleName: user.roleName ?? 'User',
      isActive: user.isActive,
    };
  }
}
