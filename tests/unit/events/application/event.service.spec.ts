import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Knex } from 'knex';
import { EventService } from '../../../../src/modules/events/application/event.service.js';
import type { EventRepository } from '../../../../src/modules/events/application/event.repository.js';
import type { TagLookupPort } from '../../../../src/modules/tags/application/ports/tag-lookup.port.js';
import type { UserLookupPort } from '../../../../src/modules/auth/application/ports/user-lookup.port.js';
import type { TagSummary } from '../../../../src/modules/tags/application/ports/tag-lookup.port.js';
import { NotFoundError, ForbiddenError } from '../../../../src/shared/domain/errors.js';
import {
  DuplicateEventTitleError,
  InvalidTagError,
} from '../../../../src/modules/events/domain/errors.js';
import type { Event } from '../../../../src/modules/events/domain/event.js';

function createMockKnex(): Knex {
  return {
    transaction: vi.fn(async (fn: (trx: unknown) => Promise<unknown>) => fn({})),
  } as unknown as Knex;
}

function createMockRepo(): EventRepository {
  const store = new Map<string, Event>();
  return {
    findById: vi.fn(async (id: string) => store.get(id) ?? null),
    findByTitle: vi.fn(async (title: string) => {
      for (const e of store.values()) {
        if (e.title === title) return e;
      }
      return null;
    }),
    create: vi.fn(async (event: Event) => {
      store.set(event.id, event);
      return event;
    }),
    update: vi.fn(async (event: Event) => {
      store.set(event.id, event);
      return event;
    }),
    delete: vi.fn(async (id: string) => {
      store.delete(id);
    }),
    list: vi.fn(async (filters: { status?: string | undefined }) => {
      let events = Array.from(store.values());
      if (filters.status) {
        events = events.filter((e) => e.status === filters.status);
      }
      return events;
    }),
    count: vi.fn(async () => store.size),
    listByOrganizer: vi.fn(async (organizerId: string) =>
      Array.from(store.values()).filter((e) => e.organizerId === organizerId),
    ),
    setTags: vi.fn(async () => {}),
    getTagsByEventId: vi.fn(async () => []),
  };
}

function createMockTagLookup(): TagLookupPort {
  const tags = new Map<string, TagSummary>();
  tags.set('tag-1', { id: 'tag-1', name: 'Technology', color: '#3b82f6' });
  tags.set('tag-2', { id: 'tag-2', name: 'Music', color: '#ef4444' });
  return {
    getTags: vi.fn(async (ids: string[]) =>
      ids.map((id) => tags.get(id)).filter((t): t is TagSummary => t !== undefined),
    ),
  };
}

function createMockUserLookup(): UserLookupPort {
  return {
    getUser: vi.fn(async () => null),
    getDisplayNames: vi.fn(async () => ({})),
  };
}

describe('EventService', () => {
  let knex: Knex;
  let repo: EventRepository;
  let tagLookup: TagLookupPort;
  let userLookup: UserLookupPort;
  let service: EventService;

  beforeEach(() => {
    knex = createMockKnex();
    repo = createMockRepo();
    tagLookup = createMockTagLookup();
    userLookup = createMockUserLookup();
    service = new EventService(knex, repo, tagLookup, userLookup);
  });

  const createInput = {
    title: 'Test Event',
    description: 'A test',
    location: 'Loc',
    startsAt: '2026-12-01T10:00:00Z',
    endsAt: '2026-12-01T14:00:00Z',
    capacity: 100,
    tagIds: ['tag-1'],
  };

  describe('create()', () => {
    it('creates event and returns DTO', async () => {
      const result = await service.create(createInput, 'user-1', 'Test User');
      expect(result.title).toBe('Test Event');
      expect(result.status).toBe('Draft');
      expect(result.organizerId).toBe('user-1');
      expect(result.tags).toHaveLength(1);
    });

    it('throws DuplicateEventTitleError for existing title', async () => {
      await service.create(createInput, 'user-1', 'User');
      await expect(service.create(createInput, 'user-1', 'User')).rejects.toThrow(
        DuplicateEventTitleError,
      );
    });

    it('throws InvalidTagError for unknown tagIds', async () => {
      await expect(
        service.create({ ...createInput, tagIds: ['unknown-tag'] }, 'user-1', 'User'),
      ).rejects.toThrow(InvalidTagError);
    });

    it('creates event with empty tags when tagIds not provided', async () => {
      const result = await service.create(
        { ...createInput, tagIds: undefined as unknown as string[] },
        'user-1',
        'User',
      );
      expect(result.tags).toEqual([]);
    });
  });

  describe('list()', () => {
    it('returns paginated results', async () => {
      await service.create(createInput, 'user-1', 'User');
      const result = await service.list({}, ['Events.Edit']);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.size).toBe(10);
      expect(result.pages).toBe(1);
    });

    it('injects Published status for non-privileged callers', async () => {
      await service.create(createInput, 'user-1', 'User');
      const result = await service.list({}, []);
      expect(result.items).toHaveLength(0);
    });

    it('shows all events for privileged callers', async () => {
      await service.create(createInput, 'user-1', 'User');
      const result = await service.list({}, ['Events.Edit']);
      expect(result.items).toHaveLength(1);
    });
  });

  describe('getById()', () => {
    it('returns published event for anonymous', async () => {
      const created = await service.create(createInput, 'user-1', 'User');
      await service.publish(created.id, 'user-1');
      const result = await service.getById(created.id, [], undefined);
      expect(result.status).toBe('Published');
    });

    it('throws NotFoundError for non-published event (anonymous)', async () => {
      const created = await service.create(createInput, 'user-1', 'User');
      await expect(service.getById(created.id, [], undefined)).rejects.toThrow(NotFoundError);
    });

    it('allows owner to view own non-published event', async () => {
      const created = await service.create(createInput, 'user-1', 'User');
      const result = await service.getById(created.id, ['Events.Edit'], 'user-1');
      expect(result.id).toBe(created.id);
    });
  });

  describe('update()', () => {
    it('updates event fields', async () => {
      const created = await service.create(createInput, 'user-1', 'User');
      const result = await service.update(
        created.id,
        { ...createInput, title: 'Updated' },
        'user-1',
      );
      expect(result.title).toBe('Updated');
    });

    it('throws ForbiddenError for non-owner', async () => {
      const created = await service.create(createInput, 'user-1', 'User');
      await expect(
        service.update(created.id, { ...createInput, title: 'X' }, 'user-2'),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('delete()', () => {
    it('deletes event', async () => {
      const created = await service.create(createInput, 'user-1', 'User');
      await service.delete(created.id, 'user-1');
      await expect(service.getById(created.id, ['Events.Edit'], 'user-1')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('throws ForbiddenError for non-owner', async () => {
      const created = await service.create(createInput, 'user-1', 'User');
      await expect(service.delete(created.id, 'user-2')).rejects.toThrow(ForbiddenError);
    });
  });

  describe('lifecycle', () => {
    it('publish() transitions to Published', async () => {
      const created = await service.create(createInput, 'user-1', 'User');
      const result = await service.publish(created.id, 'user-1');
      expect(result.status).toBe('Published');
    });

    it('cancel() transitions to Cancelled', async () => {
      const created = await service.create(createInput, 'user-1', 'User');
      const result = await service.cancel(created.id, 'user-1');
      expect(result.status).toBe('Cancelled');
    });

    it('complete() transitions to Completed', async () => {
      const created = await service.create(createInput, 'user-1', 'User');
      const result = await service.complete(created.id, 'user-1');
      expect(result.status).toBe('Completed');
    });

    it('lifecycle throws ForbiddenError for non-owner', async () => {
      const created = await service.create(createInput, 'user-1', 'User');
      await expect(service.publish(created.id, 'user-2')).rejects.toThrow(ForbiddenError);
    });
  });
});
