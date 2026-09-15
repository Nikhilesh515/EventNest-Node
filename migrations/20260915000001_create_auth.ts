import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('roles', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.string('name', 50).notNullable().unique();
    t.string('display_name', 100).notNullable();
    t.text('description').nullable();
    t.integer('sort_order').notNullable().defaultTo(0);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.string('email', 255).notNullable().unique();
    t.string('display_name', 100).notNullable();
    t.string('password_hash', 255).notNullable();
    t.uuid('role_id').notNullable().references('id').inTable('roles').onDelete('RESTRICT');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.raw('CREATE INDEX idx_users_role_id ON users(role_id)');

  await knex.schema.createTable('refresh_tokens', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.string('token_hash', 64).notNullable().unique();
    t.timestamp('expires_at', { useTz: true }).notNullable();
    t.boolean('is_revoked').notNullable().defaultTo(false);
    t.string('revoked_by_ip', 45).nullable();
    t.string('created_by_ip', 45).nullable();
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.raw('CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id)');

  await knex.schema.createTable('permission_grants', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('permission_name', 64).notNullable();
    t.boolean('is_granted').notNullable().defaultTo(true);
    t.timestamp('expires_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['user_id', 'permission_name']);
  });

  await knex.schema.raw('CREATE INDEX idx_permission_grants_user_id ON permission_grants(user_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('permission_grants');
  await knex.schema.dropTableIfExists('refresh_tokens');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('roles');
}
