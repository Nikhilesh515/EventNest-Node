import { Redis } from 'ioredis';
import { describe, expect, it, vi } from 'vitest';
import { RedisCacheAdapter } from '../../../../src/shared/infrastructure/cache/redis-cache.js';

const REDIS_URL = process.env['REDIS_URL'];
const PREFIX = 'test:core:redis:';
const describeIfRedis = REDIS_URL ? describe : describe.skip;

describe('TC-CORE-046: Redis errors propagate to the caller', () => {
  it('surfaces connection failures instead of swallowing them', async () => {
    const failure = new Error('ECONNREFUSED');
    const client = {
      get: vi.fn().mockRejectedValue(failure),
      set: vi.fn().mockRejectedValue(failure),
      del: vi.fn().mockRejectedValue(failure),
      quit: vi.fn().mockResolvedValue('OK'),
    } as unknown as Redis;
    const adapter = new RedisCacheAdapter(client, 300);

    await expect(adapter.get('k')).rejects.toThrow('ECONNREFUSED');
    await expect(adapter.set('k', 'v')).rejects.toThrow('ECONNREFUSED');
    await expect(adapter.delete('k')).rejects.toThrow('ECONNREFUSED');
  });

  it('round-trips JSON through get/set/delete with the EX option', async () => {
    const client = {
      get: vi.fn().mockResolvedValue(JSON.stringify({ n: 1 })),
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      quit: vi.fn().mockResolvedValue('OK'),
    } as unknown as Redis;
    const adapter = new RedisCacheAdapter(client, 300);

    expect(await adapter.get('k')).toEqual({ n: 1 });

    await adapter.set('k', { n: 1 }, 42);
    expect(client.set).toHaveBeenCalledWith('k', JSON.stringify({ n: 1 }), 'EX', 42);

    await adapter.set('k', { n: 1 });
    expect(client.set).toHaveBeenCalledWith('k', JSON.stringify({ n: 1 }), 'EX', 300);

    await adapter.delete('k');
    expect(client.del).toHaveBeenCalledWith('k');
  });

  it('returns null for a missing key without parsing', async () => {
    const client = {
      get: vi.fn().mockResolvedValue(null),
    } as unknown as Redis;
    const adapter = new RedisCacheAdapter(client, 300);

    expect(await adapter.get('k')).toBeNull();
  });
});

describeIfRedis('TC-CORE-043: Redis adapter CRUD and TTL (opt-in)', () => {
  const client = new Redis(REDIS_URL ?? '');
  const adapter = new RedisCacheAdapter(client, 300);
  const key = (name: string) => `${PREFIX}${name}`;

  it('performs set/get/TTL/delete/close against a real Redis', async () => {
    await adapter.set(key('a'), { n: 1 }, 2);

    expect(await adapter.get(key('a'))).toEqual({ n: 1 });

    const ttl = await client.ttl(key('a'));
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(2);

    await new Promise((resolve) => setTimeout(resolve, 2100));
    expect(await adapter.get(key('a'))).toBeNull();

    await adapter.set(key('b'), 'value', 30);
    await adapter.delete(key('b'));
    expect(await adapter.get(key('b'))).toBeNull();

    await adapter.close();
    await expect(client.get(`${PREFIX}after-close`)).rejects.toThrow();

    const cleanup = new Redis(REDIS_URL ?? '');
    const keys = await cleanup.keys(`${PREFIX}*`);
    if (keys.length > 0) {
      await cleanup.del(...keys);
    }
    await cleanup.quit();
  }, 15_000);
});
