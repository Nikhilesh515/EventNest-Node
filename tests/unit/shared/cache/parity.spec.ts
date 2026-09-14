import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CachePort } from '../../../../src/shared/application/ports/cache-port.js';
import { MemoryCacheAdapter } from '../../../../src/shared/infrastructure/cache/memory-cache.js';
import { RedisCacheAdapter } from '../../../../src/shared/infrastructure/cache/redis-cache.js';

const PREFIX = 'test:core:';
const REDIS_URL = process.env['REDIS_URL'];

interface AdapterHarness {
  adapter: CachePort;
  cleanup: () => Promise<void>;
}

async function deletePrefixedKeys(client: Redis): Promise<void> {
  const keys = await client.keys(`${PREFIX}*`);
  if (keys.length > 0) {
    await client.del(...keys);
  }
}

function memoryHarness(): AdapterHarness {
  const adapter = new MemoryCacheAdapter(300, 50);
  return { adapter, cleanup: () => adapter.close() };
}

function redisHarness(): AdapterHarness {
  const client = new Redis(REDIS_URL ?? '');
  const adapter = new RedisCacheAdapter(client, 300);
  return {
    adapter,
    cleanup: async () => {
      await deletePrefixedKeys(client);
      await client.quit();
    },
  };
}

function describeParity(label: string, create: () => AdapterHarness): void {
  describe(`Cache parity (${label})`, () => {
    let harness: AdapterHarness;

    beforeAll(() => {
      harness = create();
    });

    afterAll(async () => {
      await harness.cleanup();
    });

    it('TC-CORE-040: round-trips JSON values and returns null on miss', async () => {
      const key = (name: string) => `${PREFIX}${label}:${name}`;
      const cases: Array<[string, unknown]> = [
        ['object', { a: 1 }],
        ['array', ['x', 'y']],
        ['string', 'str'],
        ['number', 42],
        ['boolean', true],
      ];

      for (const [name, value] of cases) {
        await harness.adapter.set(key(name), value);
        expect(await harness.adapter.get(key(name))).toEqual(value);
      }

      expect(await harness.adapter.get(key('missing'))).toBeNull();
    });

    it('TC-CORE-045: delete and overwrite are interchangeable across adapters', async () => {
      const key = `${PREFIX}${label}:lifecycle`;

      await harness.adapter.set(key, { step: 1 });
      await harness.adapter.set(key, { step: 2 });
      expect(await harness.adapter.get(key)).toEqual({ step: 2 });

      await harness.adapter.delete(key);
      expect(await harness.adapter.get(key)).toBeNull();
    });
  });
}

describeParity('memory', memoryHarness);

if (REDIS_URL) {
  describeParity('redis', redisHarness);
} else {
  describe.skip('Cache parity (redis) - set REDIS_URL to run', () => {
    it('runs the same suite against the Redis adapter', () => {
      expect(true).toBe(true);
    });
  });
}
