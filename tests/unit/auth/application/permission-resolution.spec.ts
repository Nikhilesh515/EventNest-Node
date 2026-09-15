import { describe, expect, it } from 'vitest';
import {
  ALL_PERMISSIONS,
  basePermissionsForRole,
  type PermissionName,
} from '../../../../src/shared/application/permissions.js';
import { PermissionGrant } from '../../../../src/modules/auth/domain/permission-grant.js';

const sorted = (values: readonly string[]): string[] => [...values].sort();

describe('Permission resolution — role-based', () => {
  it('Admin role resolves to all 15 permissions', () => {
    const perms = basePermissionsForRole('Admin');

    expect(perms).toHaveLength(15);
    expect(sorted(perms)).toEqual(sorted(ALL_PERMISSIONS));
  });

  it('SuperAdmin role resolves to all 15 permissions', () => {
    const perms = basePermissionsForRole('SuperAdmin');

    expect(perms).toHaveLength(15);
    expect(sorted(perms)).toEqual(sorted(ALL_PERMISSIONS));
  });

  it('User role resolves to 6 default permissions', () => {
    const perms = basePermissionsForRole('User');

    expect(perms).toHaveLength(6);
    expect(perms).toContain('Events.View');
    expect(perms).toContain('Tags.View');
    expect(perms).toContain('RSVPs.View');
    expect(perms).toContain('RSVPs.Create');
    expect(perms).toContain('RSVPs.Edit');
    expect(perms).toContain('RSVPs.Cancel');
  });

  it('Organizer role resolves to 7 default permissions', () => {
    const perms = basePermissionsForRole('Organizer');

    expect(perms).toHaveLength(7);
    expect(perms).toContain('Events.View');
    expect(perms).toContain('Events.Create');
    expect(perms).toContain('Events.Edit');
    expect(perms).toContain('Tags.View');
    expect(perms).toContain('Tags.Create');
    expect(perms).toContain('RSVPs.View');
    expect(perms).toContain('RSVPs.Manage');
  });

  it('Moderator role resolves to 8 default permissions', () => {
    const perms = basePermissionsForRole('Moderator');

    expect(perms).toHaveLength(8);
    expect(perms).toContain('Events.View');
    expect(perms).toContain('Events.Create');
    expect(perms).toContain('Events.Edit');
    expect(perms).toContain('Tags.View');
    expect(perms).toContain('Tags.Create');
    expect(perms).toContain('RSVPs.View');
    expect(perms).toContain('RSVPs.Manage');
    expect(perms).toContain('Users.View');
  });

  it('unknown role returns empty set', () => {
    const perms = basePermissionsForRole('Ghost');

    expect(perms).toEqual([]);
  });

  it('empty string role returns empty set', () => {
    const perms = basePermissionsForRole('');

    expect(perms).toEqual([]);
  });
});

describe('Permission resolution — grant-based', () => {
  it('expired grants are excluded from effective permissions', () => {
    const expiredGrant = PermissionGrant.create(
      'user-1',
      'Events.Delete' as PermissionName,
      new Date('2020-01-01'),
    );
    const now = new Date('2026-01-01');

    const basePerms = basePermissionsForRole('User');
    const extraPerms = [expiredGrant].filter((g) => !g.isExpired(now)).map((g) => g.permissionName);
    const allPerms = [...new Set([...basePerms, ...extraPerms])];

    expect(extraPerms).toHaveLength(0);
    expect(allPerms).toHaveLength(6);
    expect(allPerms).not.toContain('Events.Delete');
  });

  it('non-expired grants are included in effective permissions', () => {
    const validGrant = PermissionGrant.create(
      'user-1',
      'Events.Delete' as PermissionName,
      new Date('2030-01-01'),
    );
    const now = new Date('2026-01-01');

    const basePerms = basePermissionsForRole('User');
    const extraPerms = [validGrant].filter((g) => !g.isExpired(now)).map((g) => g.permissionName);
    const allPerms = [...new Set([...basePerms, ...extraPerms])];

    expect(extraPerms).toHaveLength(1);
    expect(allPerms).toHaveLength(7);
    expect(allPerms).toContain('Events.Delete');
  });

  it('permanent grants (no expiresAt) are always included', () => {
    const permanentGrant = PermissionGrant.create('user-1', 'Events.Delete' as PermissionName);
    const now = new Date('2026-01-01');

    const basePerms = basePermissionsForRole('User');
    const extraPerms = [permanentGrant]
      .filter((g) => !g.isExpired(now))
      .map((g) => g.permissionName);
    const allPerms = [...new Set([...basePerms, ...extraPerms])];

    expect(extraPerms).toHaveLength(1);
    expect(allPerms).toContain('Events.Delete');
  });

  it('deduplicates base + grant permissions', () => {
    const basePerms = basePermissionsForRole('User');
    const duplicateGrant = PermissionGrant.create('user-1', 'Events.View' as PermissionName);

    const now = new Date('2026-01-01');
    const extraPerms = [duplicateGrant]
      .filter((g) => !g.isExpired(now))
      .map((g) => g.permissionName);
    const allPerms = [...new Set([...basePerms, ...extraPerms])];

    const viewCount = allPerms.filter((p) => p === 'Events.View').length;
    expect(viewCount).toBe(1);
  });

  it('inactive user returns empty base set', () => {
    const perms = basePermissionsForRole('');

    expect(perms).toEqual([]);
  });
});
