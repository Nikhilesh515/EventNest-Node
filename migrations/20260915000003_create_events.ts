import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('events', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.string('title', 200).notNullable().unique();
    t.string('description', 2000).nullable();
    t.string('location', 300).nullable();
    t.timestamp('starts_at', { useTz: true }).notNullable();
    t.timestamp('ends_at', { useTz: true }).notNullable();
    t.integer('capacity').notNullable();
    t.uuid('organizer_id').notNullable();
    t.string('organizer_name', 200).notNullable();
    t.string('status', 20).notNullable().defaultTo('Draft');
    t.string('visibility', 10).notNullable().defaultTo('Public');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw('ALTER TABLE events ADD CONSTRAINT chk_events_capacity CHECK (capacity >= 1)');
  await knex.raw(
    'ALTER TABLE events ADD CONSTRAINT chk_events_time_range CHECK (ends_at > starts_at)',
  );
  await knex.raw(
    "ALTER TABLE events ADD CONSTRAINT chk_events_status CHECK (status IN ('Draft','Published','Cancelled','Completed'))",
  );
  await knex.raw(
    "ALTER TABLE events ADD CONSTRAINT chk_events_visibility CHECK (visibility IN ('Public','Private'))",
  );

  await knex.schema.raw('CREATE INDEX idx_events_organizer_id ON events(organizer_id)');
  await knex.schema.raw('CREATE INDEX idx_events_starts_at ON events(starts_at)');
  await knex.schema.raw('CREATE INDEX idx_events_status ON events(status)');

  await knex.schema.createTable('event_tags', (t) => {
    t.uuid('event_id').notNullable().references('id').inTable('events').onDelete('CASCADE');
    t.uuid('tag_id').notNullable();
    t.string('tag_name', 100).notNullable();
    t.primary(['event_id', 'tag_id']);
  });

  await knex.schema.raw('CREATE INDEX idx_event_tags_tag_id ON event_tags(tag_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('event_tags');
  await knex.schema.dropTableIfExists('events');
}
