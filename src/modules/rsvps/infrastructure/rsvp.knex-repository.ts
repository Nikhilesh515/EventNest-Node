import type { Knex } from 'knex';
import type { RsvpRepository, RsvpWithEventTitle } from '../application/rsvp.repository.js';
import { Rsvp, type RsvpProps, type RsvpStatus } from '../domain/rsvp.js';

function rowToProps(row: Record<string, unknown>): RsvpProps {
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    userId: row.user_id as string,
    userName: row.user_name as string,
    status: row.status as RsvpStatus,
    guestCount: row.guest_count as number,
    notes: (row.notes as string) ?? null,
    respondedAt: row.responded_at as Date,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

export class KnexRsvpRepository implements RsvpRepository {
  constructor(private readonly knex: Knex) {}

  async findById(id: string): Promise<Rsvp | null> {
    const row = await this.knex('rsvps').where({ id }).first();
    return row ? Rsvp.reconstitute(rowToProps(row)) : null;
  }

  async findByEventAndUser(eventId: string, userId: string): Promise<Rsvp | null> {
    const row = await this.knex('rsvps').where({ event_id: eventId, user_id: userId }).first();
    return row ? Rsvp.reconstitute(rowToProps(row)) : null;
  }

  async create(rsvp: Rsvp): Promise<Rsvp> {
    const [row] = await this.knex('rsvps')
      .insert({
        id: rsvp.id,
        event_id: rsvp.eventId,
        user_id: rsvp.userId,
        user_name: rsvp.userName,
        status: rsvp.status,
        guest_count: rsvp.guestCount,
        notes: rsvp.notes,
        responded_at: rsvp.respondedAt,
        created_at: rsvp.createdAt,
        updated_at: rsvp.updatedAt,
      })
      .returning('*');
    return Rsvp.reconstitute(rowToProps(row as Record<string, unknown>));
  }

  async update(rsvp: Rsvp): Promise<Rsvp> {
    const [row] = await this.knex('rsvps')
      .where({ id: rsvp.id })
      .update({
        status: rsvp.status,
        guest_count: rsvp.guestCount,
        notes: rsvp.notes,
        responded_at: rsvp.respondedAt,
        updated_at: rsvp.updatedAt,
      })
      .returning('*');
    return Rsvp.reconstitute(rowToProps(row as Record<string, unknown>));
  }

  async delete(id: string): Promise<void> {
    await this.knex('rsvps').where({ id }).del();
  }

  async listByEvent(eventId: string): Promise<Rsvp[]> {
    const rows = await this.knex('rsvps')
      .where({ event_id: eventId })
      .orderBy('created_at', 'asc');
    return rows.map((row) => Rsvp.reconstitute(rowToProps(row)));
  }

  async listByUser(userId: string): Promise<Rsvp[]> {
    const rows = await this.knex('rsvps')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc');
    return rows.map((row) => Rsvp.reconstitute(rowToProps(row)));
  }

  async sumGuestCountByEvent(eventId: string, excludeStatus?: string): Promise<number> {
    let query = this.knex('rsvps').where({ event_id: eventId });
    if (excludeStatus) {
      query = query.whereNot('status', excludeStatus);
    }
    const result = await query.sum('guest_count as sum').first();
    return Number(result?.sum ?? 0);
  }

  async getGoingCounts(eventIds: string[]): Promise<Record<string, number>> {
    if (eventIds.length === 0) return {};
    const rows = await this.knex('rsvps')
      .whereIn('event_id', eventIds)
      .where({ status: 'Confirmed' })
      .groupBy('event_id')
      .select('event_id')
      .sum('guest_count as count');

    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.event_id as string] = Number(row.count);
    }
    return counts;
  }

  async listByEventWithEventTitle(eventId: string): Promise<RsvpWithEventTitle[]> {
    const rows = await this.knex('rsvps as r')
      .leftJoin('events as e', 'e.id', 'r.event_id')
      .where('r.event_id', eventId)
      .select('r.*', 'e.title as event_title')
      .orderBy('r.created_at', 'asc');

    return rows.map((row) => ({
      rsvp: Rsvp.reconstitute(rowToProps(row as Record<string, unknown>)),
      eventTitle: (row.event_title as string) ?? null,
    }));
  }

  async listByUserWithEventTitle(userId: string): Promise<RsvpWithEventTitle[]> {
    const rows = await this.knex('rsvps as r')
      .leftJoin('events as e', 'e.id', 'r.event_id')
      .where('r.user_id', userId)
      .select('r.*', 'e.title as event_title')
      .orderBy('r.created_at', 'desc');

    return rows.map((row) => ({
      rsvp: Rsvp.reconstitute(rowToProps(row as Record<string, unknown>)),
      eventTitle: (row.event_title as string) ?? null,
    }));
  }
}
