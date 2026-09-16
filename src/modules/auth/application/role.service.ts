import type { RoleRepository } from './role.repository.js';
import type { UserRepository } from './auth.repository.js';
import type { CachePort } from '../../../shared/application/ports/cache-port.js';
import { Role } from '../domain/role.js';
import { ALL_PERMISSIONS } from '../../../shared/application/permissions.js';
import { NotFoundError, ConflictError, ValidationError } from '../../../shared/domain/errors.js';
import type { RoleDto, CreateRoleInput, UpdateRoleInput } from './dto/role.dto.js';

export class RoleService {
  constructor(
    private readonly roles: RoleRepository,
    private readonly users: UserRepository,
    private readonly cache: CachePort,
  ) {}

  async list(): Promise<RoleDto[]> {
    const allRoles = await this.roles.findAll();
    const result: RoleDto[] = [];
    for (const role of allRoles) {
      const permissionNames = await this.roles.getPermissionNames(role.id);
      const userCount = await this.roles.countUsersByRole(role.id);
      result.push({
        id: role.id,
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        sortOrder: role.sortOrder,
        permissionNames,
        userCount,
        createdAt: role.createdAt,
      });
    }
    return result;
  }

  async getById(id: string): Promise<RoleDto> {
    const role = await this.roles.findById(id);
    if (!role) {
      throw new NotFoundError(`Role '${id}' not found.`);
    }
    const permissionNames = await this.roles.getPermissionNames(id);
    const userCount = await this.roles.countUsersByRole(id);
    return {
      id: role.id,
      name: role.name,
      displayName: role.displayName,
      description: role.description,
      sortOrder: role.sortOrder,
      permissionNames,
      userCount,
      createdAt: role.createdAt,
    };
  }

  async create(input: CreateRoleInput): Promise<RoleDto> {
    const existing = await this.roles.findByName(input.name);
    if (existing) {
      throw new ConflictError(`Role with name '${input.name}' already exists.`);
    }

    this.validatePermissionNames(input.permissionNames);

    const allRoles = await this.roles.findAll();
    const maxSort = allRoles.reduce((max, r) => Math.max(max, r.sortOrder), 0);

    const role = Role.create(input.name, input.displayName, maxSort + 1, input.description);
    await this.roles.create(role);
    await this.roles.setPermissionNames(role.id, input.permissionNames);

    const userCount = await this.roles.countUsersByRole(role.id);
    return {
      id: role.id,
      name: role.name,
      displayName: role.displayName,
      description: role.description,
      sortOrder: role.sortOrder,
      permissionNames: input.permissionNames,
      userCount,
      createdAt: role.createdAt,
    };
  }

  async update(id: string, input: UpdateRoleInput): Promise<RoleDto> {
    const role = await this.roles.findById(id);
    if (!role) {
      throw new NotFoundError(`Role '${id}' not found.`);
    }

    if (input.name !== undefined && input.name !== role.name) {
      const existing = await this.roles.findByName(input.name);
      if (existing) {
        throw new ConflictError(`Role with name '${input.name}' already exists.`);
      }
    }

    if (input.permissionNames !== undefined) {
      this.validatePermissionNames(input.permissionNames);
    }

    const updatedRow = role.toRow();
    if (input.name !== undefined) updatedRow.name = input.name;
    if (input.displayName !== undefined) updatedRow.display_name = input.displayName;
    if (input.description !== undefined) updatedRow.description = input.description;
    const updatedRole = Role.fromRow(updatedRow);

    await this.roles.update(updatedRole);

    if (input.permissionNames !== undefined) {
      await this.roles.setPermissionNames(id, input.permissionNames);
      await this.invalidateCacheForRole(id);
    }

    const permissionNames = input.permissionNames ?? (await this.roles.getPermissionNames(id));
    const userCount = await this.roles.countUsersByRole(id);
    return {
      id: updatedRole.id,
      name: updatedRole.name,
      displayName: updatedRole.displayName,
      description: updatedRole.description,
      sortOrder: updatedRole.sortOrder,
      permissionNames,
      userCount,
      createdAt: updatedRole.createdAt,
    };
  }

  async delete(id: string): Promise<void> {
    const role = await this.roles.findById(id);
    if (!role) {
      throw new NotFoundError(`Role '${id}' not found.`);
    }

    if (role.isBuiltin) {
      throw new ValidationError('Cannot delete built-in role.', {
        role: [`Role '${role.name}' is a built-in role and cannot be deleted.`],
      });
    }

    const userCount = await this.roles.countUsersByRole(id);
    if (userCount > 0) {
      throw new ValidationError('Cannot delete role with assigned users.', {
        role: [`Role '${role.name}' has ${userCount} user(s) assigned. Reassign them first.`],
      });
    }

    await this.roles.delete(id);
  }

  async assignUserRole(userId: string, roleId: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundError(`User '${userId}' not found.`);
    }

    const role = await this.roles.findById(roleId);
    if (!role) {
      throw new NotFoundError(`Role '${roleId}' not found.`);
    }

    await this.users.updateRoleId(userId, roleId);
    await this.cache.delete(`user:${userId}:permissions`);
  }

  private validatePermissionNames(permissionNames: string[]): void {
    const allPerms = new Set<string>(ALL_PERMISSIONS);
    for (const pn of permissionNames) {
      if (!allPerms.has(pn)) {
        throw new ValidationError(`Unknown permission '${pn}'.`, {
          permissionNames: [`'${pn}' is not a valid permission.`],
        });
      }
    }
  }

  private async invalidateCacheForRole(roleId: string): Promise<void> {
    const users = await this.users.findByRoleId(roleId);
    for (const user of users) {
      await this.cache.delete(`user:${user.id}:permissions`);
    }
  }
}
