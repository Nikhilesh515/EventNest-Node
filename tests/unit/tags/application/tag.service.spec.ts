import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TagService } from '../../../../src/modules/tags/application/tag.service.js';
import { Tag } from '../../../../src/modules/tags/domain/tag.js';
import { TagAlreadyExistsError } from '../../../../src/modules/tags/domain/errors.js';
import { NotFoundError } from '../../../../src/shared/domain/errors.js';
import type { TagRepository } from '../../../../src/modules/tags/application/tag.repository.js';

function createMockRepo(): TagRepository {
  const store = new Map<string, Tag>();
  return {
    findById: vi.fn(async (id: string) => store.get(id) ?? null),
    findByName: vi.fn(async (name: string) => {
      for (const tag of store.values()) {
        if (tag.name === name) return tag;
      }
      return null;
    }),
    create: vi.fn(async (tag: Tag) => {
      store.set(tag.id, tag);
      return tag;
    }),
    update: vi.fn(async (tag: Tag) => {
      store.set(tag.id, tag);
      return tag;
    }),
    delete: vi.fn(async (id: string) => {
      store.delete(id);
    }),
    list: vi.fn(async () => Array.from(store.values())),
  };
}

describe('TagService', () => {
  let repo: TagRepository;
  let service: TagService;

  beforeEach(() => {
    repo = createMockRepo();
    service = new TagService(repo);
  });

  describe('list', () => {
    it('returns all tags as DTOs', async () => {
      const tag = Tag.create('Tech', '#3b82f6');
      await repo.create(tag);

      const result = await service.list();
      expect(result).toHaveLength(1);
      const first = result[0];
      expect(first?.name).toBe('Tech');
      expect(first?.createdAt).toBeTypeOf('string');
    });
  });

  describe('getById', () => {
    it('returns tag by ID', async () => {
      const tag = Tag.create('Music', '#ef4444');
      await repo.create(tag);

      const result = await service.getById(tag.id);
      expect(result.name).toBe('Music');
    });

    it('throws NotFoundError for unknown ID', async () => {
      await expect(service.getById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('create', () => {
    it('creates a new tag', async () => {
      const result = await service.create('Sports', '#10b981');
      expect(result.name).toBe('Sports');
      expect(result.color).toBe('#10b981');
      expect(result.id).toBeDefined();
    });

    it('throws TagAlreadyExistsError for duplicate name', async () => {
      await service.create('Tech', '#3b82f6');
      await expect(service.create('Tech', '#000000')).rejects.toThrow(TagAlreadyExistsError);
    });
  });

  describe('update', () => {
    it('updates an existing tag', async () => {
      const created = await service.create('Old', '#000000');
      const result = await service.update(created.id, 'New', '#ffffff');
      expect(result.name).toBe('New');
      expect(result.color).toBe('#ffffff');
    });

    it('throws NotFoundError for unknown ID', async () => {
      await expect(service.update('nonexistent', 'X', '#000')).rejects.toThrow(NotFoundError);
    });

    it('throws TagAlreadyExistsError for duplicate name (excluding self)', async () => {
      const tagA = await service.create('TagA', '#000000');
      await service.create('TagB', '#111111');
      await expect(service.update(tagA.id, 'TagB', '#000000')).rejects.toThrow(
        TagAlreadyExistsError,
      );
    });

    it('allows keeping same name on update', async () => {
      const tag = await service.create('Same', '#000000');
      const result = await service.update(tag.id, 'Same', '#ffffff');
      expect(result.name).toBe('Same');
      expect(result.color).toBe('#ffffff');
    });
  });

  describe('delete', () => {
    it('deletes an existing tag', async () => {
      const tag = await service.create('ToDelete', '#000000');
      await service.delete(tag.id);
      await expect(service.getById(tag.id)).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError for unknown ID', async () => {
      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });
});
