import type { Role } from '../domain/role.js';

export interface RoleRepository {
  findAll(): Promise<Role[]>;
  findById(id: string): Promise<Role | null>;
  findByName(name: string): Promise<Role | null>;
  create(role: Role): Promise<Role>;
  update(role: Role): Promise<Role>;
  delete(id: string): Promise<void>;
  countUsersByRole(roleId: string): Promise<number>;
  getPermissionNames(roleId: string): Promise<string[]>;
  setPermissionNames(roleId: string, permissionNames: string[]): Promise<void>;
}
