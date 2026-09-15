import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  const existing = await knex('events').count('id as cnt').first();
  if (existing && Number(existing.cnt) > 0) return;

  const now = Date.now();
  const day = 86_400_000;

  const adminUser = await knex('users').where({ email: 'admin@eventnest.io' }).first();
  if (!adminUser) throw new Error('Admin user not found — run 002_users.ts first');

  const events = [
    {
      title: 'Tech Meetup 2026',
      description: 'Monthly tech meetup for developers',
      location: 'Convention Center',
      starts_at: new Date(now + 30 * day),
      ends_at: new Date(now + 30 * day + 3 * 3_600_000),
      capacity: 100,
      status: 'Draft',
      visibility: 'Public',
      organizer_id: adminUser.id,
      organizer_name: 'System Admin',
    },
    {
      title: 'Food Festival',
      description: 'Annual food festival featuring local restaurants',
      location: 'City Park',
      starts_at: new Date(now + 60 * day),
      ends_at: new Date(now + 60 * day + 8 * 3_600_000),
      capacity: 500,
      status: 'Published',
      visibility: 'Public',
      organizer_id: adminUser.id,
      organizer_name: 'System Admin',
    },
    {
      title: 'Music Concert',
      description: 'Live music event with local bands',
      location: 'Arena',
      starts_at: new Date(now + 45 * day),
      ends_at: new Date(now + 45 * day + 4 * 3_600_000),
      capacity: 200,
      status: 'Draft',
      visibility: 'Public',
      organizer_id: adminUser.id,
      organizer_name: 'System Admin',
    },
  ];

  const insertedEvents = await knex('events').insert(events).returning(['id', 'title']);

  const techTag = await knex('tags').where({ name: 'Technology' }).first();
  const foodTag = await knex('tags').where({ name: 'Food & Drink' }).first();
  const musicTag = await knex('tags').where({ name: 'Music' }).first();

  const eventTags = [
    {
      event_id: insertedEvents[0]!.id,
      tag_id: techTag!.id,
      tag_name: 'Technology',
    },
    {
      event_id: insertedEvents[1]!.id,
      tag_id: foodTag!.id,
      tag_name: 'Food & Drink',
    },
    {
      event_id: insertedEvents[2]!.id,
      tag_id: musicTag!.id,
      tag_name: 'Music',
    },
  ];

  await knex('event_tags').insert(eventTags);
}
