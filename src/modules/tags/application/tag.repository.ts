import type { Tag } from '../domain/tag.js';

export interface TagRepository {
  findById(id: string): Promise<Tag | null>;
  findByName(name: string): Promise<Tag | null>;
  create(tag: Tag): Promise<Tag>;
  update(tag: Tag): Promise<Tag>;
  delete(id: string): Promise<void>;
  list(): Promise<Tag[]>;
}
