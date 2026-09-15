import type { Rsvp } from '../domain/rsvp.js';

export interface RsvpWithEventTitle {
  rsvp: Rsvp;
  eventTitle: string | null;
  eventStartsAt: Date | null;
  eventLocation: string | null;
}

export interface RsvpRepository {
  findById(id: string): Promise<Rsvp | null>;
  findByEventAndUser(eventId: string, userId: string): Promise<Rsvp | null>;
  create(rsvp: Rsvp): Promise<Rsvp>;
  update(rsvp: Rsvp): Promise<Rsvp>;
  delete(id: string): Promise<void>;
  listByEvent(eventId: string): Promise<Rsvp[]>;
  listByUser(userId: string): Promise<Rsvp[]>;
  sumGuestCountByEvent(eventId: string, excludeStatus?: string): Promise<number>;
  getGoingCounts(eventIds: string[]): Promise<Record<string, number>>;
  listByEventWithEventTitle(eventId: string): Promise<RsvpWithEventTitle[]>;
  listByUserWithEventTitle(userId: string): Promise<RsvpWithEventTitle[]>;
}
