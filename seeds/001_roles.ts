import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  const existing = await knex('roles').count('id as cnt').first();
  if (existing && Number(existing.cnt) > 0) return;

  await knex('roles').insert([
    {
      name: 'User',
      display_name: 'User',
      description: 'Default role for all users.',
      sort_order: 1,
    },
    {
      name: 'Organizer',
      display_name: 'Organizer',
      description: 'Can create and manage events.',
      sort_order: 2,
    },
    {
      name: 'Moderator',
      display_name: 'Moderator',
      description: 'Can moderate content and view users.',
      sort_order: 3,
    },
    {
      name: 'Admin',
      display_name: 'Admin',
      description: 'Full access to all permissions.',
      sort_order: 4,
    },
    {
      name: 'SuperAdmin',
      display_name: 'Super Admin',
      description: 'Unrestricted access, can manage roles.',
      sort_order: 5,
    },
  ]);
}
