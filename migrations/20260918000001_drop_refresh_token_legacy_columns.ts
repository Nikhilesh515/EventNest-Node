import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('refresh_tokens', (t) => {
    t.dropColumn('is_revoked');
    t.dropColumn('revoked_by_ip');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('refresh_tokens', (t) => {
    t.boolean('is_revoked').notNullable().defaultTo(false);
    t.string('revoked_by_ip', 45).nullable();
  });
}
