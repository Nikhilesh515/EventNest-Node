export interface PermissionProviderPort {
  getEffectivePermissions(userId: string): Promise<string[]>;
}
