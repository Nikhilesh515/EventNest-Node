import { describe, expect, it } from 'vitest';
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  ROLE_DEFAULTS,
  basePermissionsForRole,
  isPermissionName,
  type PermissionName,
} from '../../../src/shared/application/permissions.js';

const EXPECTED_CATALOG: PermissionName[] = [
  'Events.View',
  'Events.Create',
  'Events.Edit',
  'Events.Delete',
  'Tags.View',
  'Tags.Create',
  'Tags.Edit',
  'Tags.Delete',
  'RSVPs.View',
  'RSVPs.Create',
  'RSVPs.Edit',
  'RSVPs.Manage',
  'RSVPs.Cancel',
  'Users.View',
  'Users.Manage',
];

const sorted = (values: readonly string[]): string[] => [...values].sort();
const defaults = (role: string): string[] => sorted(ROLE_DEFAULTS[role] ?? []);

describe('TC-CORE-030: Catalog equals README section 6', () => {
  it('contains exactly 15 permissions across 4 groups', () => {
    expect(ALL_PERMISSIONS).toHaveLength(15);
    expect(sorted(ALL_PERMISSIONS)).toEqual(sorted(EXPECTED_CATALOG));
    expect(Object.keys(PERMISSIONS.Events)).toHaveLength(4);
    expect(Object.keys(PERMISSIONS.Tags)).toHaveLength(4);
    expect(Object.keys(PERMISSIONS.RSVPs)).toHaveLength(5);
    expect(Object.keys(PERMISSIONS.Users)).toHaveLength(2);
  });
});

describe('TC-CORE-031: Grouped constants and PermissionName union', () => {
  it('nested constants resolve to their wire strings', () => {
    expect(PERMISSIONS.Events.View).toBe('Events.View');
    expect(PERMISSIONS.Tags.Delete).toBe('Tags.Delete');
    expect(PERMISSIONS.RSVPs.Manage).toBe('RSVPs.Manage');
    expect(PERMISSIONS.Users.Manage).toBe('Users.Manage');
  });

  it('typed returns compile as PermissionName[]', () => {
    const permissions: PermissionName[] = basePermissionsForRole('User');

    expect(permissions).toContain('Events.View');
  });

  it('rejects non-catalog strings at compile time', () => {
    // @ts-expect-error 'Events.Fly' is not part of the catalog
    const invalid: PermissionName = 'Events.Fly';

    expect(invalid).toBe('Events.Fly');
  });
});

describe('TC-CORE-032: Role defaults per role', () => {
  it('matches the documented defaults for User, Organizer, and Moderator', () => {
    expect(defaults('User')).toEqual(
      sorted([
        'Events.View',
        'Tags.View',
        'RSVPs.View',
        'RSVPs.Create',
        'RSVPs.Edit',
        'RSVPs.Cancel',
      ]),
    );

    expect(defaults('Organizer')).toEqual(
      sorted([
        'Events.View',
        'Events.Create',
        'Events.Edit',
        'Tags.View',
        'Tags.Create',
        'RSVPs.View',
        'RSVPs.Manage',
      ]),
    );

    expect(defaults('Moderator')).toEqual(sorted([...defaults('Organizer'), 'Users.View']));
  });

  it('omits Admin and SuperAdmin from the static defaults', () => {
    expect(ROLE_DEFAULTS['Admin']).toBeUndefined();
    expect(ROLE_DEFAULTS['SuperAdmin']).toBeUndefined();
  });
});

describe('TC-CORE-033: Admin expansion and unknown-role denial', () => {
  it('expands Admin and SuperAdmin to all 15 permissions', () => {
    for (const role of ['Admin', 'SuperAdmin']) {
      expect(sorted(basePermissionsForRole(role))).toEqual(sorted(ALL_PERMISSIONS));
      expect(basePermissionsForRole(role)).toHaveLength(15);
    }
  });

  it('returns an empty set for unknown or lowercase roles without throwing', () => {
    expect(basePermissionsForRole('Ghost')).toEqual([]);
    expect(basePermissionsForRole('admin')).toEqual([]);
  });
});

describe('TC-CORE-035: isPermissionName type guard', () => {
  it('accepts only catalog names', () => {
    expect(isPermissionName('Events.View')).toBe(true);
    expect(isPermissionName('Users.Manage')).toBe(true);
    expect(isPermissionName('Events.Fly')).toBe(false);
    expect(isPermissionName('')).toBe(false);
    expect(isPermissionName(42 as unknown as string)).toBe(false);
  });
});
