import type { Knex } from 'knex';
import type { Event, EventStatus, EventVisibility } from '../domain/event.js';

export interface EventListFilters {
  search?: string | undefined;
  tagId?: string[] | undefined;
  visibility?: EventVisibility | undefined;
  status?: EventStatus | undefined;
  timeframe?: 'upcoming' | 'past' | 'all' | undefined;
  sort?: string | undefined;
  offset: number;
  limit: number;
}

export interface EventRepository {
  findById(id: string): Promise<Event | null>;
  findByTitle(title: string): Promise<Event | null>;
  create(event: Event, trx?: Knex.Transaction): Promise<Event>;
  update(event: Event): Promise<Event>;
  delete(id: string): Promise<void>;
  list(filters: EventListFilters): Promise<Event[]>;
  count(filters: Omit<EventListFilters, 'offset' | 'limit'>): Promise<number>;
  listByOrganizer(organizerId: string): Promise<Event[]>;
  setTags(eventId: string, tags: { tagId: string; tagName: string }[], trx?: Knex.Transaction): Promise<void>;
  getTagsByEventId(eventId: string): Promise<{ tagId: string; tagName: string }[]>;
}
