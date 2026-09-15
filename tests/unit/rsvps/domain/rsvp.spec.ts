import { describe, expect, it } from 'vitest';
import { Rsvp } from '../../../../src/modules/rsvps/domain/rsvp.js';

describe('Rsvp Entity', () => {
  const validInput = {
    eventId: 'evt-123',
    userId: 'user-456',
    userName: 'Test User',
    guestCount: 2,
    notes: 'Vegetarian meal',
  };

  describe('create()', () => {
    it('generates a UUID id', () => {
      const rsvp = Rsvp.create(validInput);
      expect(rsvp.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('defaults status to Confirmed', () => {
      const rsvp = Rsvp.create(validInput);
      expect(rsvp.status).toBe('Confirmed');
    });

    it('normalizes guestCount < 1 to 1', () => {
      expect(Rsvp.create({ ...validInput, guestCount: 0 }).guestCount).toBe(1);
      expect(Rsvp.create({ ...validInput, guestCount: -5 }).guestCount).toBe(1);
    });

    it('preserves valid guestCount', () => {
      expect(Rsvp.create({ ...validInput, guestCount: 3 }).guestCount).toBe(3);
    });

    it('defaults guestCount to 1 when not provided', () => {
      expect(Rsvp.create({ ...validInput, guestCount: undefined as unknown as number }).guestCount).toBe(1);
    });

    it('sets notes to null when not provided', () => {
      const rsvp = Rsvp.create({ ...validInput, notes: undefined as unknown as string | null });
      expect(rsvp.notes).toBeNull();
    });

    it('preserves notes when provided', () => {
      const rsvp = Rsvp.create({ ...validInput, notes: 'Special request' });
      expect(rsvp.notes).toBe('Special request');
    });

    it('sets timestamps', () => {
      const before = Date.now();
      const rsvp = Rsvp.create(validInput);
      const after = Date.now();
      expect(rsvp.createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(rsvp.createdAt.getTime()).toBeLessThanOrEqual(after);
      expect(rsvp.respondedAt.getTime()).toBeGreaterThanOrEqual(before);
    });
  });

  describe('reconstitute()', () => {
    it('restores all props from database row', () => {
      const props = {
        id: 'rsvp-1',
        eventId: 'evt-1',
        userId: 'user-1',
        userName: 'DB User',
        status: 'Maybe' as const,
        guestCount: 3,
        notes: 'Note',
        respondedAt: new Date('2026-01-01'),
        createdAt: new Date('2026-01-02'),
        updatedAt: new Date('2026-01-03'),
      };
      const rsvp = Rsvp.reconstitute(props);
      expect(rsvp.id).toBe('rsvp-1');
      expect(rsvp.status).toBe('Maybe');
      expect(rsvp.guestCount).toBe(3);
    });
  });

  describe('updateStatus()', () => {
    it('changes status and bumps respondedAt', () => {
      const rsvp = Rsvp.create(validInput);
      const beforeResponded = rsvp.respondedAt.getTime();
      rsvp.updateStatus('Maybe');
      expect(rsvp.status).toBe('Maybe');
      expect(rsvp.respondedAt.getTime()).toBeGreaterThanOrEqual(beforeResponded);
    });
  });

  describe('updateGuestCount()', () => {
    it('normalizes guestCount < 1 to 1', () => {
      const rsvp = Rsvp.create(validInput);
      rsvp.updateGuestCount(0);
      expect(rsvp.guestCount).toBe(1);
    });

    it('preserves valid guestCount', () => {
      const rsvp = Rsvp.create(validInput);
      rsvp.updateGuestCount(5);
      expect(rsvp.guestCount).toBe(5);
    });
  });

  describe('updateNotes()', () => {
    it('updates notes', () => {
      const rsvp = Rsvp.create(validInput);
      rsvp.updateNotes('New notes');
      expect(rsvp.notes).toBe('New notes');
    });

    it('sets notes to null', () => {
      const rsvp = Rsvp.create(validInput);
      rsvp.updateNotes(null);
      expect(rsvp.notes).toBeNull();
    });
  });
});
