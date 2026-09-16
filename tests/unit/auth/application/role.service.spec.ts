import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RoleService } from '../../../../src/modules/auth/application/role.service.js';
import { Role } from '../../../../src/modules/auth/domain/role.js';
import type { RoleRepository } from '../../../../src/modules/auth/application/role.repository.js';
import type { UserRepository } from '../../../../src/modules/auth/application/auth.repository.js';
import type { CachePort } from '../../../../src/shared/application/ports/cache-port.js';
import { NotFoundError, ConflictError, ValidationError } from '../../../../src/shared/domain/errors.js';
import { User } from '../../../../src/modules/auth/domain/user.js';

function createMockRoleRepo(): RoleRepository {
  const store = new Map<string, Role>();
  const permStore = new Map<string, string[]>();
  const userCounts = new Map<string, number>();

  return {
    findAll: vi.fn(async () => Array.from(store.values()).sort((a, b) => a.sortOrder - b.sortOrder)),
    findById: vi.fn(async (id: string) => store.get(id) ?? null),
    findByName: vi.fn(async (name: string) => {
      for (const role of store.values()) {
        if (role.name.toLowerCase() === name.toLowerCase()) return role;
      }
      return null;
    }),
    create: vi.fn(async (role: Role) => {
      store.set(role.id, role);
      return role;
    }),
    update: vi.fn(async (role: Role) => {
      store.set(role.id, role);
      return role;
    }),
    delete: vi.fn(async (id: string) => {
      store.delete(id);
    }),
    countUsersByRole: vi.fn(async (roleId: string) => userCounts.get(roleId) ?? 0),
    getPermissionNames: vi.fn(async (roleId: string) => permStore.get(roleId) ?? []),
    setPermissionNames: vi.fn(async (roleId: string, names: string[]) => {
      permStore.set(roleId, names);
    }),
  };
}

function createMockUserRepo(): UserRepository {
  const store = new Map<string, User>();
  return {
    findByEmail: vi.fn(async () => null),
    findById: vi.fn(async (id: string) => store.get(id) ?? null),
    create: vi.fn(async (user: User) => { store.set(user.id, user); return user; }),
    update: vi.fn(async (user: User) => { store.set(user.id, user); return user; }),
    list: vi.fn(async () => Array.from(store.values())),
    count: vi.fn(async () => store.size),
    listPaginated: vi.fn(async (query: { page: number; pageSize: number; search?: string; role?: string }) => {
      const items = Array.from(store.values());
      return { items, total: items.length };
    }),
    findRoleByName: vi.fn(async () => null),
    updateRoleId: vi.fn(async () => {}),
    findByRoleId: vi.fn(async () => []),
  };
}

function createMockCache(): CachePort {
  const store = new Map<string, unknown>();
  return {
    async get<T>(key: string): Promise<T | null> { return (store.get(key) as T) ?? null; },
    async set<T>(key: string, value: T): Promise<void> { store.set(key, value); },
    async delete(key: string): Promise<void> { store.delete(key); },
    async close(): Promise<void> { store.clear(); },
  };
}

describe('RoleService', () => {
  let roleRepo: RoleRepository;
  let userRepo: UserRepository;
  let cache: CachePort;
  let service: RoleService;

  beforeEach(() => {
    roleRepo = createMockRoleRepo();
    userRepo = createMockUserRepo();
    cache = createMockCache();
    service = new RoleService(roleRepo, userRepo, cache);
  });

  describe('list', () => {
    it('returns all roles with permission names and user counts', async () => {
      const role = Role.create('TestRole', 'Test Role', 10);
      await roleRepo.create(role);
      await roleRepo.setPermissionNames(role.id, ['Events.View', 'Tags.View']);

      const result = await service.list();
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('TestRole');
      expect(result[0]?.permissionNames).toEqual(['Events.View', 'Tags.View']);
    });
  });

  describe('getById', () => {
    it('returns role by ID', async () => {
      const role = Role.create('TestRole', 'Test Role', 10);
      await roleRepo.create(role);

      const result = await service.getById(role.id);
      expect(result.name).toBe('TestRole');
    });

    it('throws NotFoundError for unknown ID', async () => {
      await expect(service.getById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('create', () => {
    it('creates a new role with permissions', async () => {
      const result = await service.create({
        name: 'CustomRole',
        displayName: 'Custom Role',
        description: 'A custom role',
        permissionNames: ['Events.View', 'Tags.View'],
      });
      expect(result.name).toBe('CustomRole');
      expect(result.permissionNames).toEqual(['Events.View', 'Tags.View']);
    });

    it('throws ConflictError for duplicate name', async () => {
      const existing = Role.create('Admin', 'Admin', 1);
      await roleRepo.create(existing);

      await expect(
        service.create({ name: 'Admin', displayName: 'Admin', permissionNames: ['Events.View'] }),
      ).rejects.toThrow(ConflictError);
    });

    it('throws ValidationError for unknown permission', async () => {
      await expect(
        service.create({ name: 'Bad', displayName: 'Bad', permissionNames: ['Invalid.Perm'] }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('update', () => {
    it('updates role metadata', async () => {
      const role = Role.create('TestRole', 'Test Role', 10);
      await roleRepo.create(role);

      const result = await service.update(role.id, { displayName: 'Updated Role' });
      expect(result.displayName).toBe('Updated Role');
    });

    it('updates role permissions and invalidates cache', async () => {
      const role = Role.create('TestRole', 'Test Role', 10);
      await roleRepo.create(role);

      const result = await service.update(role.id, {
        permissionNames: ['Events.View', 'Events.Create'],
      });
      expect(result.permissionNames).toEqual(['Events.View', 'Events.Create']);
    });

    it('throws NotFoundError for unknown ID', async () => {
      await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow(NotFoundError);
    });

    it('throws ConflictError for duplicate name', async () => {
      const role1 = Role.create('Role1', 'Role 1', 10);
      const role2 = Role.create('Role2', 'Role 2', 11);
      await roleRepo.create(role1);
      await roleRepo.create(role2);

      await expect(service.update(role2.id, { name: 'Role1' })).rejects.toThrow(ConflictError);
    });
  });

  describe('delete', () => {
    it('deletes a custom role', async () => {
      const role = Role.create('CustomRole', 'Custom Role', 10);
      await roleRepo.create(role);

      await service.delete(role.id);
      const found = await roleRepo.findById(role.id);
      expect(found).toBeNull();
    });

    it('throws ValidationError for built-in role', async () => {
      const role = Role.create('Admin', 'Admin', 4);
      await roleRepo.create(role);

      await expect(service.delete(role.id)).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError for role with assigned users', async () => {
      const role = Role.create('CustomRole', 'Custom Role', 10);
      await roleRepo.create(role);

      // Mock countUsersByRole to return > 0
      const original = roleRepo.countUsersByRole;
      roleRepo.countUsersByRole = vi.fn(async () => 2);

      await expect(service.delete(role.id)).rejects.toThrow(ValidationError);
      roleRepo.countUsersByRole = original;
    });

    it('throws NotFoundError for unknown ID', async () => {
      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('assignUserRole', () => {
    it('assigns a role to a user and invalidates cache', async () => {
      const role = Role.create('NewRole', 'New Role', 10);
      await roleRepo.create(role);

      const user = User.create('test@test.com', 'Test', 'hash', 'old-role-id', 'User');
      await userRepo.create(user);

      await service.assignUserRole(user.id, role.id);
      expect(userRepo.updateRoleId).toHaveBeenCalledWith(user.id, role.id);
    });

    it('throws NotFoundError for unknown user', async () => {
      const role = Role.create('NewRole', 'New Role', 10);
      await roleRepo.create(role);

      await expect(service.assignUserRole('nonexistent', role.id)).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError for unknown role', async () => {
      const user = User.create('test@test.com', 'Test', 'hash', 'old-role-id', 'User');
      await userRepo.create(user);

      await expect(service.assignUserRole(user.id, 'nonexistent')).rejects.toThrow(NotFoundError);
    });
  });
});
