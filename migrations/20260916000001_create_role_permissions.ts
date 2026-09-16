import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('role_permissions', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('role_id').notNullable().references('id').inTable('roles').onDelete('CASCADE');
    t.string('permission_name', 64).notNullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['role_id', 'permission_name']);
  });

  await knex.schema.raw('CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id)');

  const roles = await knex('roles').select('id', 'name');
  const roleMap = Object.fromEntries(
    roles.map((r: { id: string; name: string }) => [r.name, r.id]),
  );

  const ROLE_DEFAULTS: Record<string, string[]> = {
    User: ['Events.View', 'Tags.View', 'RSVPs.View', 'RSVPs.Create', 'RSVPs.Edit', 'RSVPs.Cancel'],
    Organizer: [
      'Events.View',
      'Events.Create',
      'Events.Edit',
      'Tags.View',
      'Tags.Create',
      'RSVPs.View',
      'RSVPs.Manage',
    ],
    Moderator: [
      'Events.View',
      'Events.Create',
      'Events.Edit',
      'Tags.View',
      'Tags.Create',
      'RSVPs.View',
      'RSVPs.Manage',
      'Users.View',
    ],
    Admin: [
      'Events.View',
      'Events.Create',
      'Events.Edit',
      'Events.Delete',
      'Tags.View',
      'Tags.Create',
      'Tags.Edit',
      'Tags.Delete',
      'RSVPs.View',
      'RSVPs.Create',
      'RSVPs.Edit',
      'RSVPs.Manage',
      'RSVPs.Cancel',
      'Users.View',
      'Users.Manage',
    ],
    SuperAdmin: [
      'Events.View',
      'Events.Create',
      'Events.Edit',
      'Events.Delete',
      'Tags.View',
      'Tags.Create',
      'Tags.Edit',
      'Tags.Delete',
      'RSVPs.View',
      'RSVPs.Create',
      'RSVPs.Edit',
      'RSVPs.Manage',
      'RSVPs.Cancel',
      'Users.View',
      'Users.Manage',
    ],
  };

  const rows = Object.entries(ROLE_DEFAULTS).flatMap(([roleName, perms]) =>
    perms.map((permission_name) => ({
      role_id: roleMap[roleName],
      permission_name,
    })),
  );

  await knex('role_permissions').insert(rows);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('role_permissions');
}
