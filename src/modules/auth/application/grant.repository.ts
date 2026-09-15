import type { PermissionGrant } from '../domain/permission-grant.js';

export interface GrantRepository {
  findByUserAndPermission(userId: string, permissionName: string): Promise<PermissionGrant | null>;
  findActiveByUser(userId: string): Promise<PermissionGrant[]>;
  create(grant: PermissionGrant): Promise<PermissionGrant>;
  delete(userId: string, permissionName: string): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
}
