import type { Knex } from 'knex';
import dotenv from 'dotenv';

dotenv.config();

const development: Knex.Config = {
  client: 'pg',
  connection: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5433/eventnest',
  migrations: { directory: './migrations', extension: 'ts' },
  seeds: { directory: './seeds', extension: 'ts' },
};

const test: Knex.Config = {
  client: 'pg',
  connection:
    process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5433/eventnest_test',
  migrations: { directory: './migrations', extension: 'ts' },
  seeds: { directory: './seeds', extension: 'ts' },
};

const production: Knex.Config = {
  client: 'pg',
  connection: process.env.DATABASE_URL!,
  migrations: { directory: './migrations', extension: 'ts' },
  seeds: { directory: './seeds', extension: 'ts' },
};

const config: Record<string, Knex.Config> = {
  development,
  test,
  production,
};

export default config;
