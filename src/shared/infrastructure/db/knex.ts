import knex, { type Knex } from 'knex';

export function buildKnex(databaseUrl: string): Knex {
  return knex({
    client: 'pg',
    connection: databaseUrl,
    pool: {
      min: Number(process.env.DB_POOL_MIN ?? 2),
      max: Number(process.env.DB_POOL_MAX ?? 10),
      idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_MS ?? 30_000),
    },
  });
}

export async function destroyKnex(knexInstance: Knex): Promise<void> {
  await knexInstance.destroy();
}
