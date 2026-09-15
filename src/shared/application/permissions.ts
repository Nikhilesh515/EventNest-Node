export const PERMISSIONS = {
  Events: {
    View: 'Events.View',
    Create: 'Events.Create',
    Edit: 'Events.Edit',
    Delete: 'Events.Delete',
  },
  Tags: { View: 'Tags.View', Create: 'Tags.Create', Edit: 'Tags.Edit', Delete: 'Tags.Delete' },
  RSVPs: {
    View: 'RSVPs.View',
    Create: 'RSVPs.Create',
    Edit: 'RSVPs.Edit',
    Manage: 'RSVPs.Manage',
    Cancel: 'RSVPs.Cancel',
  },
  Users: { View: 'Users.View', Manage: 'Users.Manage' },
} as const;

type GroupValues<T> = T[keyof T];
export type PermissionName = GroupValues<{
  [G in keyof typeof PERMISSIONS]: GroupValues<(typeof PERMISSIONS)[G]>;
}>;

export const ALL_PERMISSIONS = Object.values(PERMISSIONS).flatMap((group) =>
  Object.values(group),
) as readonly PermissionName[];

const ORGANIZER_DEFAULTS: readonly PermissionName[] = [
  PERMISSIONS.Events.View,
  PERMISSIONS.Events.Create,
  PERMISSIONS.Events.Edit,
  PERMISSIONS.Tags.View,
  PERMISSIONS.Tags.Create,
  PERMISSIONS.RSVPs.View,
  PERMISSIONS.RSVPs.Manage,
];

export const ROLE_DEFAULTS: Record<string, readonly PermissionName[]> = {
  User: [
    PERMISSIONS.Events.View,
    PERMISSIONS.Tags.View,
    PERMISSIONS.RSVPs.View,
    PERMISSIONS.RSVPs.Create,
    PERMISSIONS.RSVPs.Edit,
    PERMISSIONS.RSVPs.Cancel,
  ],
  Organizer: ORGANIZER_DEFAULTS,
  Moderator: [...ORGANIZER_DEFAULTS, PERMISSIONS.Users.View],
};

export interface PermissionCatalogEntry {
  name: PermissionName;
  displayName: string;
  group: string;
}

function buildCatalog(): PermissionCatalogEntry[] {
  const entries: PermissionCatalogEntry[] = [];
  for (const [group, perms] of Object.entries(PERMISSIONS)) {
    for (const [key, value] of Object.entries(perms)) {
      entries.push({
        name: value,
        displayName: `${group} ${key}`,
        group,
      });
    }
  }
  return entries;
}

export const PERMISSION_CATALOG: readonly PermissionCatalogEntry[] = buildCatalog();

const FULL_ACCESS_ROLES = new Set(['Admin', 'SuperAdmin']);
const PERMISSION_NAMES = new Set<string>(ALL_PERMISSIONS);

export function basePermissionsForRole(roleName: string): PermissionName[] {
  if (FULL_ACCESS_ROLES.has(roleName)) {
    return [...ALL_PERMISSIONS];
  }
  return [...(ROLE_DEFAULTS[roleName] ?? [])];
}

export function isPermissionName(value: string): value is PermissionName {
  return PERMISSION_NAMES.has(value);
}
