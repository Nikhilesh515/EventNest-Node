import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import knex from 'knex';
import config from '../knexfile.js';

const env = process.env.NODE_ENV ?? 'development';
const db = knex(config[env]!);

async function runSeeds(): Promise<void> {
  const seedsDir = join(process.cwd(), 'seeds');
  const files = (await readdir(seedsDir)).filter((f) => f.endsWith('.ts') && f !== 'run.ts').sort();

  for (const file of files) {
    console.log(`Running seed: ${file}`);
    const filePath = pathToFileURL(join(seedsDir, file)).href;
    const mod = await import(filePath);
    if (typeof mod.seed === 'function') {
      await mod.seed(db);
    }
  }

  console.log('All seeds completed.');
}

runSeeds()
  .then(() => db.destroy())
  .catch(async (err) => {
    console.error('Seed failed:', err);
    await db.destroy();
    process.exit(1);
  });
