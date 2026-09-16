import type { User } from '../domain/user.js';

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(user: User): Promise<User>;
  update(user: User): Promise<User>;
  list(page: number, pageSize: number): Promise<User[]>;
  count(): Promise<number>;
  listPaginated(query: {
    page: number;
    pageSize: number;
    search?: string;
    role?: string;
  }): Promise<{ items: User[]; total: number }>;
  findRoleByName(name: string): Promise<{ id: string; name: string } | null>;
  updateRoleId(userId: string, roleId: string): Promise<void>;
  findByRoleId(roleId: string): Promise<User[]>;
}
