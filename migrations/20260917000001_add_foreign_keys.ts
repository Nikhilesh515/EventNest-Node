import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('events', (table) => {
    table.foreign('organizer_id').references('id').inTable('users').onDelete('RESTRICT');
  });

  await knex.schema.alterTable('rsvps', (table) => {
    table.foreign('event_id').references('id').inTable('events').onDelete('CASCADE');
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
  });

  await knex.schema.alterTable('event_tags', (table) => {
    table.foreign('tag_id').references('id').inTable('tags').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('event_tags', (table) => {
    table.dropForeign(['tag_id']);
  });

  await knex.schema.alterTable('rsvps', (table) => {
    table.dropForeign(['event_id']);
    table.dropForeign(['user_id']);
  });

  await knex.schema.alterTable('events', (table) => {
    table.dropForeign(['organizer_id']);
  });
}
