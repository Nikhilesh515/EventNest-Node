import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { User } from '../../../../src/modules/auth/domain/user.js';
import { Role, type RoleName } from '../../../../src/modules/auth/domain/role.js';
import { RefreshToken } from '../../../../src/modules/auth/domain/refresh-token.js';
import { PermissionGrant } from '../../../../src/modules/auth/domain/permission-grant.js';

describe('User entity', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('User.create()', () => {
    it('assigns a random UUID id', () => {
      const user = User.create('a@b.com', 'Alice', 'hash', 'role-1', 'User');

      expect(user.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('sets isActive to true', () => {
      const user = User.create('a@b.com', 'Alice', 'hash', 'role-1', 'User');

      expect(user.isActive).toBe(true);
    });

    it('sets createdAt to a recent date', () => {
      const before = new Date();
      const user = User.create('a@b.com', 'Alice', 'hash', 'role-1', 'User');
      const after = new Date();

      expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
      expect(user.createdAt.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
    });

    it('sets updatedAt equal to createdAt', () => {
      const user = User.create('a@b.com', 'Alice', 'hash', 'role-1', 'User');

      expect(user.updatedAt).toEqual(user.createdAt);
    });

    it('stores all constructor arguments', () => {
      const user = User.create('a@b.com', 'Alice', 'hash-123', 'role-42', 'Admin');

      expect(user.email).toBe('a@b.com');
      expect(user.displayName).toBe('Alice');
      expect(user.passwordHash).toBe('hash-123');
      expect(user.roleId).toBe('role-42');
      expect(user.roleName).toBe('Admin');
    });
  });

  describe('User.deactivate()', () => {
    it('sets isActive to false', () => {
      const user = User.create('a@b.com', 'Alice', 'hash', 'role-1', 'User');

      user.deactivate();

      expect(user.isActive).toBe(false);
    });

    it('updates updatedAt timestamp', () => {
      const user = User.create('a@b.com', 'Alice', 'hash', 'role-1', 'User');
      const originalUpdatedAt = user.updatedAt;

      vi.advanceTimersByTime(1000);
      user.deactivate();

      expect(user.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('User.updateProfile()', () => {
    it('changes displayName', () => {
      const user = User.create('a@b.com', 'Alice', 'hash', 'role-1', 'User');

      user.updateProfile('Bob');

      expect(user.displayName).toBe('Bob');
    });

    it('updates updatedAt timestamp', () => {
      const user = User.create('a@b.com', 'Alice', 'hash', 'role-1', 'User');
      const originalUpdatedAt = user.updatedAt;

      vi.advanceTimersByTime(1000);
      user.updateProfile('Bob');

      expect(user.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });
});

describe('Role entity', () => {
  describe('Role.create()', () => {
    const roleCases: Array<{ name: RoleName; displayName: string; sortOrder: number }> = [
      { name: 'User', displayName: 'Regular User', sortOrder: 1 },
      { name: 'Organizer', displayName: 'Event Organizer', sortOrder: 2 },
      { name: 'Moderator', displayName: 'Moderator', sortOrder: 3 },
      { name: 'Admin', displayName: 'Administrator', sortOrder: 4 },
      { name: 'SuperAdmin', displayName: 'Super Administrator', sortOrder: 5 },
    ];

    it.each(roleCases)('creates a $name role with correct properties', ({ name, displayName, sortOrder }) => {
      const role = Role.create(name, displayName, sortOrder);

      expect(role.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(role.name).toBe(name);
      expect(role.displayName).toBe(displayName);
      expect(role.sortOrder).toBe(sortOrder);
      expect(role.description).toBeNull();
      expect(role.createdAt).toBeInstanceOf(Date);
    });
  });
});

describe('RefreshToken entity', () => {
  describe('RefreshToken.create()', () => {
    it('assigns a random UUID id', () => {
      const token = RefreshToken.create('user-1', 'hash-abc', new Date());

      expect(token.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('sets revokedAt to null', () => {
      const token = RefreshToken.create('user-1', 'hash-abc', new Date());

      expect(token.revokedAt).toBeNull();
    });

    it('sets replacedByTokenHash to null', () => {
      const token = RefreshToken.create('user-1', 'hash-abc', new Date());

      expect(token.replacedByTokenHash).toBeNull();
    });

    it('stores userId, tokenHash, and expiresAt', () => {
      const expiresAt = new Date('2026-12-31');
      const token = RefreshToken.create('user-1', 'hash-abc', expiresAt, '127.0.0.1');

      expect(token.userId).toBe('user-1');
      expect(token.tokenHash).toBe('hash-abc');
      expect(token.expiresAt).toEqual(expiresAt);
      expect(token.createdByIp).toBe('127.0.0.1');
    });

    it('sets createdByIp to null when not provided', () => {
      const token = RefreshToken.create('user-1', 'hash-abc', new Date());

      expect(token.createdByIp).toBeNull();
    });
  });

  describe('RefreshToken.revoke()', () => {
    it('sets revokedAt to a date', () => {
      const token = RefreshToken.create('user-1', 'hash-abc', new Date());

      token.revoke();

      expect(token.revokedAt).toBeInstanceOf(Date);
    });

    it('sets replacedByTokenHash when provided', () => {
      const token = RefreshToken.create('user-1', 'hash-abc', new Date());

      token.revoke('new-hash-def');

      expect(token.replacedByTokenHash).toBe('new-hash-def');
    });

    it('sets replacedByTokenHash to null when not provided', () => {
      const token = RefreshToken.create('user-1', 'hash-abc', new Date());

      token.revoke();

      expect(token.replacedByTokenHash).toBeNull();
    });
  });

  describe('RefreshToken.isExpired()', () => {
    it('returns true when expiresAt is before now', () => {
      const pastDate = new Date('2020-01-01');
      const token = RefreshToken.create('user-1', 'hash-abc', pastDate);

      expect(token.isExpired(new Date('2026-01-01'))).toBe(true);
    });

    it('returns false when expiresAt is after now', () => {
      const futureDate = new Date('2030-01-01');
      const token = RefreshToken.create('user-1', 'hash-abc', futureDate);

      expect(token.isExpired(new Date('2026-01-01'))).toBe(false);
    });

    it('returns true when expiresAt equals now', () => {
      const now = new Date();
      const token = RefreshToken.create('user-1', 'hash-abc', now);

      expect(token.isExpired(now)).toBe(true);
    });
  });

  describe('RefreshToken.isRevoked', () => {
    it('returns false when revokedAt is null', () => {
      const token = RefreshToken.create('user-1', 'hash-abc', new Date());

      expect(token.isRevoked).toBe(false);
    });

    it('returns true after revoke()', () => {
      const token = RefreshToken.create('user-1', 'hash-abc', new Date());

      token.revoke();

      expect(token.isRevoked).toBe(true);
    });
  });
});

describe('PermissionGrant entity', () => {
  describe('PermissionGrant.create()', () => {
    it('assigns a random UUID id', () => {
      const grant = PermissionGrant.create('user-1', 'Events.View');

      expect(grant.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('sets isGranted to true', () => {
      const grant = PermissionGrant.create('user-1', 'Events.View');

      expect(grant.isGranted).toBe(true);
    });

    it('sets expiresAt to null when not provided', () => {
      const grant = PermissionGrant.create('user-1', 'Events.View');

      expect(grant.expiresAt).toBeNull();
    });

    it('sets expiresAt when provided', () => {
      const expiry = new Date('2026-12-31');
      const grant = PermissionGrant.create('user-1', 'Events.View', expiry);

      expect(grant.expiresAt).toEqual(expiry);
    });

    it('stores userId and permissionName', () => {
      const grant = PermissionGrant.create('user-42', 'Tags.Create');

      expect(grant.userId).toBe('user-42');
      expect(grant.permissionName).toBe('Tags.Create');
    });
  });

  describe('PermissionGrant.isExpired()', () => {
    it('returns true when expiresAt is before now', () => {
      const grant = PermissionGrant.create('user-1', 'Events.View', new Date('2020-01-01'));

      expect(grant.isExpired(new Date('2026-01-01'))).toBe(true);
    });

    it('returns false when expiresAt is after now', () => {
      const grant = PermissionGrant.create('user-1', 'Events.View', new Date('2030-01-01'));

      expect(grant.isExpired(new Date('2026-01-01'))).toBe(false);
    });

    it('returns false when expiresAt is null (no expiry)', () => {
      const grant = PermissionGrant.create('user-1', 'Events.View');

      expect(grant.isExpired(new Date('2026-01-01'))).toBe(false);
    });

    it('returns true when expiresAt equals now', () => {
      const now = new Date();
      const grant = PermissionGrant.create('user-1', 'Events.View', now);

      expect(grant.isExpired(now)).toBe(true);
    });
  });
});
