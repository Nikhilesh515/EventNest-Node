import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  const existing = await knex('tags').count('id as cnt').first();
  if (existing && Number(existing.cnt) > 0) return;

  await knex('tags').insert([
    { name: 'Technology', color: '#3b82f6' },
    { name: 'Music', color: '#ef4444' },
    { name: 'Food & Drink', color: '#f59e0b' },
    { name: 'Sports', color: '#10b981' },
    { name: 'Networking', color: '#8b5cf6' },
  ]);
}
