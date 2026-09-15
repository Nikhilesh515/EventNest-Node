export type PermissionSource = 'role-default' | 'direct-grant' | 'none';

export interface PermissionDto {
  name: string;
  displayName: string;
  group: string;
  isGranted: boolean;
  source: PermissionSource;
}