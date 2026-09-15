import type { Knex } from 'knex';
import bcrypt from 'bcrypt';

export async function seed(knex: Knex): Promise<void> {
  const existing = await knex('users').where({ email: 'admin@eventnest.io' }).first();
  if (existing) return;

  const adminRole = await knex('roles').where({ name: 'Admin' }).first();
  if (!adminRole) throw new Error('Admin role not found — run 001_roles.ts first');

  const hash = await bcrypt.hash('Admin@123', 12);
  await knex('users').insert({
    email: 'admin@eventnest.io',
    display_name: 'Admin User',
    password_hash: hash,
    role_id: adminRole.id,
    is_active: true,
  });
}
