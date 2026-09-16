export interface RoleDto {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  sortOrder: number;
  permissionNames: string[];
  userCount: number;
  createdAt: Date;
}

export interface CreateRoleInput {
  name: string;
  displayName: string;
  description?: string;
  permissionNames: string[];
}

export interface UpdateRoleInput {
  name?: string;
  displayName?: string;
  description?: string;
  permissionNames?: string[];
}
