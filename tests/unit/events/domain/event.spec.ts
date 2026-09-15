import { describe, expect, it } from 'vitest';
import { Event } from '../../../../src/modules/events/domain/event.js';

describe('Event Entity', () => {
  const validInput = {
    title: 'Test Event',
    description: 'A test event',
    location: 'Test Location',
    startsAt: new Date('2026-12-01T10:00:00Z'),
    endsAt: new Date('2026-12-01T14:00:00Z'),
    capacity: 100,
    organizerId: 'org-123',
    organizerName: 'Org Name',
  };

  describe('create()', () => {
    it('generates a UUID id', () => {
      const event = Event.create(validInput);
      expect(event.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('defaults status to Draft', () => {
      const event = Event.create(validInput);
      expect(event.status).toBe('Draft');
    });

    it('defaults visibility to Public', () => {
      const event = Event.create(validInput);
      expect(event.visibility).toBe('Public');
    });

    it('defaults tags to empty array', () => {
      const event = Event.create(validInput);
      expect(event.tags).toEqual([]);
    });

    it('sets description and location to null when not provided', () => {
      const event = Event.create({
        title: 'Minimal',
        startsAt: new Date(),
        endsAt: new Date(),
        capacity: 10,
        organizerId: 'id',
        organizerName: 'name',
      });
      expect(event.description).toBeNull();
      expect(event.location).toBeNull();
    });

    it('sets createdAt and updatedAt to current time', () => {
      const before = Date.now();
      const event = Event.create(validInput);
      const after = Date.now();
      expect(event.createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(event.createdAt.getTime()).toBeLessThanOrEqual(after);
      expect(event.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(event.updatedAt.getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe('reconstitute()', () => {
    it('restores all props from database row', () => {
      const props = {
        id: 'evt-1',
        title: 'Reconstituted',
        description: 'Desc',
        location: 'Loc',
        startsAt: new Date('2026-06-01'),
        endsAt: new Date('2026-06-02'),
        capacity: 50,
        organizerId: 'org-1',
        organizerName: 'Organizer',
        status: 'Published' as const,
        visibility: 'Private' as const,
        tags: [{ tagId: 't1', tagName: 'Tech' }],
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      };
      const event = Event.reconstitute(props);
      expect(event.id).toBe('evt-1');
      expect(event.title).toBe('Reconstituted');
      expect(event.status).toBe('Published');
      expect(event.visibility).toBe('Private');
      expect(event.tags).toEqual([{ tagId: 't1', tagName: 'Tech' }]);
    });
  });

  describe('lifecycle methods', () => {
    it('publish() sets status to Published and bumps updatedAt', () => {
      const event = Event.create(validInput);
      const before = event.updatedAt.getTime();
      event.publish();
      expect(event.status).toBe('Published');
      expect(event.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('cancel() sets status to Cancelled and bumps updatedAt', () => {
      const event = Event.create(validInput);
      event.cancel();
      expect(event.status).toBe('Cancelled');
    });

    it('complete() sets status to Completed and bumps updatedAt', () => {
      const event = Event.create(validInput);
      event.complete();
      expect(event.status).toBe('Completed');
    });
  });

  describe('update()', () => {
    it('modifies all mutable fields and bumps updatedAt', () => {
      const event = Event.create(validInput);
      const before = event.updatedAt.getTime();
      event.update({
        title: 'Updated Title',
        description: 'New desc',
        location: 'New loc',
        startsAt: new Date('2027-01-01'),
        endsAt: new Date('2027-01-02'),
        capacity: 200,
        tags: [{ tagId: 't1', tagName: 'Tag1' }],
      });
      expect(event.title).toBe('Updated Title');
      expect(event.description).toBe('New desc');
      expect(event.location).toBe('New loc');
      expect(event.capacity).toBe(200);
      expect(event.tags).toEqual([{ tagId: 't1', tagName: 'Tag1' }]);
      expect(event.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
    });
  });
});
