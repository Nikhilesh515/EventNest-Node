import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('rsvps', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('event_id').notNullable();
    t.uuid('user_id').notNullable();
    t.string('user_name', 200).notNullable();
    t.string('status', 20).notNullable();
    t.integer('guest_count').notNullable().defaultTo(1);
    t.string('notes', 1000).nullable();
    t.timestamp('responded_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['event_id', 'user_id']);
  });

  await knex.raw(
    "ALTER TABLE rsvps ADD CONSTRAINT chk_rsvps_status CHECK (status IN ('Confirmed','Maybe','Declined','Cancelled'))",
  );
  await knex.raw('ALTER TABLE rsvps ADD CONSTRAINT chk_rsvps_guest_count CHECK (guest_count >= 1)');

  await knex.schema.raw('CREATE INDEX idx_rsvps_event_id ON rsvps(event_id)');
  await knex.schema.raw('CREATE INDEX idx_rsvps_user_id ON rsvps(user_id)');
  await knex.schema.raw('CREATE INDEX idx_rsvps_status ON rsvps(status)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('rsvps');
}
