export interface UserSummary {
  id: string;
  email: string;
  displayName: string;
  roleName: string;
  isActive: boolean;
}

export interface UserLookupPort {
  getUser(id: string): Promise<UserSummary | null>;
  getDisplayNames(ids: string[]): Promise<Record<string, string>>;
}
