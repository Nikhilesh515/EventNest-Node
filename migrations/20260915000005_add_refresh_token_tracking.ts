import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('refresh_tokens', (t) => {
    t.timestamp('revoked_at', { useTz: true }).nullable();
    t.string('replaced_by_token_hash', 64).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('refresh_tokens', (t) => {
    t.dropColumn('revoked_at');
    t.dropColumn('replaced_by_token_hash');
  });
}
