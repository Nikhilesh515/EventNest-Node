import type { Knex } from 'knex';
import type { EventRepository, EventListFilters } from '../application/event.repository.js';
import { Event, type EventProps, type EventStatus, type EventVisibility } from '../domain/event.js';

function rowToProps(row: Record<string, unknown>): EventProps {
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) ?? null,
    location: (row.location as string) ?? null,
    startsAt: row.starts_at as Date,
    endsAt: row.ends_at as Date,
    capacity: row.capacity as number,
    organizerId: row.organizer_id as string,
    organizerName: row.organizer_name as string,
    status: row.status as EventStatus,
    visibility: row.visibility as EventVisibility,
    tags: [],
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

const SORT_MAP: Record<string, { column: string; direction: 'asc' | 'desc' }> = {
  'date-asc': { column: 'starts_at', direction: 'asc' },
  'date-desc': { column: 'starts_at', direction: 'desc' },
  'created-desc': { column: 'created_at', direction: 'desc' },
  popularity: { column: 'going_count', direction: 'desc' },
};

export class KnexEventRepository implements EventRepository {
  constructor(private readonly knex: Knex) {}

  async findById(id: string): Promise<Event | null> {
    const row = await this.knex('events').where({ id }).first();
    if (!row) return null;
    const tags = await this.getTagsByEventId(id);
    return Event.reconstitute({ ...rowToProps(row), tags });
  }

  async findByTitle(title: string): Promise<Event | null> {
    const row = await this.knex('events').where({ title }).first();
    return row ? Event.reconstitute(rowToProps(row)) : null;
  }

  async create(event: Event, trx?: Knex.Transaction): Promise<Event> {
    const client = trx ?? this.knex;
    const [row] = await client('events')
      .insert({
        id: event.id,
        title: event.title,
        description: event.description,
        location: event.location,
        starts_at: event.startsAt,
        ends_at: event.endsAt,
        capacity: event.capacity,
        organizer_id: event.organizerId,
        organizer_name: event.organizerName,
        status: event.status,
        visibility: event.visibility,
        created_at: event.createdAt,
        updated_at: event.updatedAt,
      })
      .returning('*');
    return Event.reconstitute(rowToProps(row as Record<string, unknown>));
  }

  async update(event: Event): Promise<Event> {
    const [row] = await this.knex('events')
      .where({ id: event.id })
      .update({
        title: event.title,
        description: event.description,
        location: event.location,
        starts_at: event.startsAt,
        ends_at: event.endsAt,
        capacity: event.capacity,
        status: event.status,
        visibility: event.visibility,
        updated_at: event.updatedAt,
      })
      .returning('*');
    const tags = await this.getTagsByEventId(event.id);
    return Event.reconstitute({ ...rowToProps(row as Record<string, unknown>), tags });
  }

  async delete(id: string): Promise<void> {
    await this.knex('events').where({ id }).del();
  }

  async list(filters: EventListFilters): Promise<Event[]> {
    const isPopularity = filters.sort === 'popularity';
    const query = this.buildFilterQuery(filters, isPopularity);

    if (isPopularity) {
      query.leftJoin(
        this.knex('rsvps')
          .select('event_id')
          .sum('guest_count as going_count')
          .where('status', 'Confirmed')
          .groupBy('event_id')
          .as('rsvp_stats'),
        'events.id',
        'rsvp_stats.event_id',
      );
    }

    const sort = SORT_MAP[filters.sort ?? 'created-desc'] ?? SORT_MAP['created-desc']!;
    query.orderBy(sort.column, sort.direction);
    query.offset(filters.offset);
    query.limit(filters.limit);

    const rows: Record<string, unknown>[] = await query;
    const tagsByEvent = await this.loadTagsForEvents(rows.map((r) => r.id as string));

    return rows.map((row) =>
      Event.reconstitute({ ...rowToProps(row), tags: tagsByEvent[row.id as string] ?? [] }),
    );
  }

  async count(filters: Omit<EventListFilters, 'offset' | 'limit'>): Promise<number> {
    const query = this.knex('events').count('* as cnt');
    this.applyFilters(query, filters);
    const result = await query.first();
    return Number(result?.cnt ?? 0);
  }

  async listByOrganizer(organizerId: string): Promise<Event[]> {
    const rows: Record<string, unknown>[] = await this.knex('events')
      .where({ organizer_id: organizerId })
      .orderBy('created_at', 'desc');

    const tagsByEvent = await this.loadTagsForEvents(rows.map((r) => r.id as string));

    return rows.map((row) =>
      Event.reconstitute({ ...rowToProps(row), tags: tagsByEvent[row.id as string] ?? [] }),
    );
  }

  async setTags(
    eventId: string,
    tags: { tagId: string; tagName: string }[],
    trx?: Knex.Transaction,
  ): Promise<void> {
    const client = trx ?? this.knex;
    await client('event_tags').where({ event_id: eventId }).del();
    if (tags.length > 0) {
      await client('event_tags').insert(
        tags.map((t) => ({ event_id: eventId, tag_id: t.tagId, tag_name: t.tagName })),
      );
    }
  }

  async getTagsByEventId(eventId: string): Promise<{ tagId: string; tagName: string }[]> {
    const rows = await this.knex('event_tags')
      .where({ event_id: eventId })
      .select('tag_id', 'tag_name');
    return rows.map((r) => ({ tagId: r.tag_id, tagName: r.tag_name }));
  }

  private async loadTagsForEvents(
    eventIds: string[],
  ): Promise<Record<string, { tagId: string; tagName: string }[]>> {
    if (eventIds.length === 0) return {};

    const rows = await this.knex('event_tags')
      .whereIn('event_id', eventIds)
      .select('event_id', 'tag_id', 'tag_name');

    return rows.reduce(
      (acc, row) => {
        if (!acc[row.event_id]) acc[row.event_id] = [];
        acc[row.event_id].push({ tagId: row.tag_id, tagName: row.tag_name });
        return acc;
      },
      {} as Record<string, { tagId: string; tagName: string }[]>,
    );
  }

  private buildFilterQuery(
    filters: Omit<EventListFilters, 'offset' | 'limit'>,
    includePopularityJoin: boolean,
  ): Knex.QueryBuilder {
    const query = this.knex('events').select('events.*');
    if (!includePopularityJoin) {
      this.applyFilters(query, filters);
    } else {
      this.applyFilters(query, filters);
    }
    return query;
  }

  private applyFilters(
    query: Knex.QueryBuilder,
    filters: Omit<EventListFilters, 'offset' | 'limit'>,
  ): void {
    if (filters.search) {
      const pattern = `%${filters.search}%`;
      query.where(function () {
        this.whereILike('title', pattern)
          .orWhereILike('description', pattern)
          .orWhereILike('location', pattern);
      });
    }

    if (filters.visibility) {
      query.where({ visibility: filters.visibility });
    }

    if (filters.status) {
      query.where({ status: filters.status });
    }

    if (filters.timeframe === 'upcoming') {
      query.where('ends_at', '>=', new Date());
    } else if (filters.timeframe === 'past') {
      query.where('ends_at', '<', new Date());
    }

    if (filters.tagId && filters.tagId.length > 0) {
      query.whereIn(
        'id',
        this.knex('event_tags').select('event_id').whereIn('tag_id', filters.tagId),
      );
    }
  }
}
