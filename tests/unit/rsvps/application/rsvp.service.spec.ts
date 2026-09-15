import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RsvpService } from '../../../../src/modules/rsvps/application/rsvp.service.js';
import type { RsvpRepository } from '../../../../src/modules/rsvps/application/rsvp.repository.js';
import type { EventLookupPort, EventSummary } from '../../../../src/modules/events/application/ports/event-lookup.port.js';
import type { UserLookupPort } from '../../../../src/modules/auth/application/ports/user-lookup.port.js';
import { NotFoundError } from '../../../../src/shared/domain/errors.js';
import {
  AlreadyRsvpedError,
  RsvpToUnpublishedEventError,
  RsvpOwnershipError,
  InvalidRsvpStatusError,
} from '../../../../src/modules/rsvps/domain/errors.js';
import type { Rsvp } from '../../../../src/modules/rsvps/domain/rsvp.js';

function createMockRepo(): RsvpRepository {
  const store = new Map<string, Rsvp>();
  return {
    findById: vi.fn(async (id: string) => store.get(id) ?? null),
    findByEventAndUser: vi.fn(async (eventId: string, userId: string) => {
      for (const r of store.values()) {
        if (r.eventId === eventId && r.userId === userId) return r;
      }
      return null;
    }),
    create: vi.fn(async (rsvp: Rsvp) => {
      store.set(rsvp.id, rsvp);
      return rsvp;
    }),
    update: vi.fn(async (rsvp: Rsvp) => {
      store.set(rsvp.id, rsvp);
      return rsvp;
    }),
    delete: vi.fn(async (id: string) => {
      store.delete(id);
    }),
    listByEvent: vi.fn(async (eventId: string) =>
      Array.from(store.values()).filter((r) => r.eventId === eventId),
    ),
    listByUser: vi.fn(async (userId: string) =>
      Array.from(store.values()).filter((r) => r.userId === userId),
    ),
    sumGuestCountByEvent: vi.fn(async (eventId: string, excludeStatus?: string) => {
      let rsvps = Array.from(store.values()).filter((r) => r.eventId === eventId);
      if (excludeStatus) rsvps = rsvps.filter((r) => r.status !== excludeStatus);
      return rsvps.reduce((sum, r) => sum + r.guestCount, 0);
    }),
    getGoingCounts: vi.fn(async (eventIds: string[]) => {
      const counts: Record<string, number> = {};
      for (const id of eventIds) {
        const confirmed = Array.from(store.values()).filter(
          (r) => r.eventId === id && r.status === 'Confirmed',
        );
        counts[id] = confirmed.reduce((sum, r) => sum + r.guestCount, 0);
      }
      return counts;
    }),
    listByEventWithEventTitle: vi.fn(async (eventId: string) => {
      const rsvps = Array.from(store.values()).filter((r) => r.eventId === eventId);
      return rsvps.map((r) => ({ rsvp: r, eventTitle: 'Test Event' }));
    }),
    listByUserWithEventTitle: vi.fn(async (userId: string) => {
      const rsvps = Array.from(store.values()).filter((r) => r.userId === userId);
      return rsvps.map((r) => ({ rsvp: r, eventTitle: 'Test Event' }));
    }),
  };
}

function createMockEventLookup(): EventLookupPort {
  const events = new Map<string, EventSummary>();
  events.set('pub-event', {
    id: 'pub-event',
    title: 'Published Event',
    startsAt: new Date(),
    endsAt: new Date(),
    organizerId: 'organizer-1',
    status: 'Published',
    capacity: 10,
  });
  events.set('draft-event', {
    id: 'draft-event',
    title: 'Draft Event',
    startsAt: new Date(),
    endsAt: new Date(),
    organizerId: 'organizer-1',
    status: 'Draft',
    capacity: 10,
  });
  return {
    getEvent: vi.fn(async (id: string) => events.get(id) ?? null),
  };
}

describe('RsvpService', () => {
  let repo: RsvpRepository;
  let eventLookup: EventLookupPort;
  let userLookup: UserLookupPort;
  let service: RsvpService;

  beforeEach(() => {
    repo = createMockRepo();
    eventLookup = createMockEventLookup();
    userLookup = { getUser: vi.fn(async () => null), getDisplayNames: vi.fn(async () => ({})) };
    service = new RsvpService(repo, eventLookup, userLookup);
  });

  describe('create()', () => {
    it('creates RSVP as Confirmed', async () => {
      const result = await service.create('pub-event', { guestCount: 2 }, 'user-1', 'User 1');
      expect(result.status).toBe('Confirmed');
      expect(result.guestCount).toBe(2);
      expect(result.eventId).toBe('pub-event');
    });

    it('throws NotFoundError for missing event', async () => {
      await expect(
        service.create('missing', { guestCount: 1 }, 'user-1', 'User'),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws RsvpToUnpublishedEventError for Draft event', async () => {
      await expect(
        service.create('draft-event', { guestCount: 1 }, 'user-1', 'User'),
      ).rejects.toThrow(RsvpToUnpublishedEventError);
    });

    it('throws AlreadyRsvpedError for duplicate non-cancelled RSVP', async () => {
      await service.create('pub-event', { guestCount: 1 }, 'user-1', 'User');
      await expect(
        service.create('pub-event', { guestCount: 1 }, 'user-1', 'User'),
      ).rejects.toThrow(AlreadyRsvpedError);
    });

    it('reactivates cancelled RSVP', async () => {
      const rsvp = await service.create('pub-event', { guestCount: 1 }, 'user-1', 'User');
      await service.cancelOwn('pub-event', 'user-1');
      const reactivated = await service.create('pub-event', { guestCount: 2 }, 'user-1', 'User');
      expect(reactivated.id).toBe(rsvp.id);
      expect(reactivated.guestCount).toBe(2);
    });

    it('normalizes guestCount < 1', async () => {
      const result = await service.create('pub-event', { guestCount: 0 }, 'user-1', 'User');
      expect(result.guestCount).toBe(1);
    });
  });

  describe('cancelOwn()', () => {
    it('cancels own RSVP', async () => {
      await service.create('pub-event', { guestCount: 1 }, 'user-1', 'User');
      await service.cancelOwn('pub-event', 'user-1');
      const rsvp = await repo.findByEventAndUser('pub-event', 'user-1');
      expect(rsvp?.status).toBe('Cancelled');
    });

    it('throws NotFoundError when no RSVP', async () => {
      await expect(service.cancelOwn('pub-event', 'user-1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('update()', () => {
    it('updates status', async () => {
      const created = await service.create('pub-event', { guestCount: 1 }, 'user-1', 'User');
      const result = await service.update(created.id, { status: 'Maybe' }, 'user-1');
      expect(result.status).toBe('Maybe');
    });

    it('throws RsvpOwnershipError for non-owner', async () => {
      const created = await service.create('pub-event', { guestCount: 1 }, 'user-1', 'User');
      await expect(service.update(created.id, { status: 'Maybe' }, 'user-2')).rejects.toThrow(
        RsvpOwnershipError,
      );
    });

    it('throws InvalidRsvpStatusError for bad status', async () => {
      const created = await service.create('pub-event', { guestCount: 1 }, 'user-1', 'User');
      await expect(
        service.update(created.id, { status: 'Invalid' }, 'user-1'),
      ).rejects.toThrow(InvalidRsvpStatusError);
    });
  });

  describe('getById()', () => {
    it('returns RSVP', async () => {
      const created = await service.create('pub-event', { guestCount: 1 }, 'user-1', 'User');
      const result = await service.getById(created.id);
      expect(result.id).toBe(created.id);
    });

    it('throws NotFoundError', async () => {
      await expect(service.getById('missing')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getGoingCounts()', () => {
    it('returns confirmed guest counts', async () => {
      await service.create('pub-event', { guestCount: 3 }, 'user-1', 'User');
      const counts = await service.getGoingCounts(['pub-event']);
      expect(counts['pub-event']).toBe(3);
    });
  });
});
