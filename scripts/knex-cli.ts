import knex from 'knex';
import config from '../knexfile.js';

const command = process.argv[2];
const env = process.env.NODE_ENV ?? 'development';
const knexConfig = config[env]!;

const db = knex(knexConfig);

try {
  switch (command) {
    case 'migrate:latest': {
      const [batchNo, log] = await db.migrate.latest();
      if (log.length === 0) {
        console.log('Already up to date.');
      } else {
        console.log(`Ran ${log.length} migration(s) in batch ${batchNo}: ${log.join(', ')}`);
      }
      break;
    }
    case 'migrate:rollback': {
      const all = process.argv.includes('--all');
      if (all) {
        const log = await db.migrate.rollback(undefined, true);
        console.log(`Rolled back ${log.length} migration(s): ${log.join(', ')}`);
      } else {
        const [batchNo, log] = await db.migrate.rollback();
        if (log.length === 0) {
          console.log('Already at the base migration.');
        } else {
          console.log(
            `Rolled back ${log.length} migration(s) in batch ${batchNo}: ${log.join(', ')}`,
          );
        }
      }
      break;
    }
    case 'migrate:status': {
      const [batchNo, migrations] = await db.migrate.list();
      console.log(`Current batch: ${batchNo}`);
      for (const m of migrations) {
        console.log(`  ${m.file}`);
      }
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      console.error(
        'Usage: tsx scripts/knex-cli.ts <migrate:latest|migrate:rollback|migrate:status>',
      );
      process.exit(1);
  }
} finally {
  await db.destroy();
}
