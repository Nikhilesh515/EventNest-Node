import { Writable } from 'node:stream';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { testConfig } from '../../../helpers/app.js';
import {
  createCache,
  sanitizeRedisTarget,
} from '../../../../src/shared/infrastructure/cache/create-cache.js';
import { MemoryCacheAdapter } from '../../../../src/shared/infrastructure/cache/memory-cache.js';
import { RedisCacheAdapter } from '../../../../src/shared/infrastructure/cache/redis-cache.js';

function capturingLogger(lines: string[]) {
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(String(chunk));
      callback();
    },
  });
  return pino({ level: 'info' }, stream);
}

describe('TC-CORE-044: Factory selection and sanitized log', () => {
  it('selects the memory adapter when REDIS_URL is not set', async () => {
    const cache = createCache(testConfig(), capturingLogger([]));

    expect(cache).toBeInstanceOf(MemoryCacheAdapter);
    await cache.close();
  });

  it('selects the Redis adapter when REDIS_URL is set and logs host:port only', async () => {
    const lines: string[] = [];
    const cache = createCache(
      testConfig({ REDIS_URL: 'redis://user:S3cret@localhost:6379/0' }),
      capturingLogger(lines),
    );

    expect(cache).toBeInstanceOf(RedisCacheAdapter);

    const output = lines.join('');
    expect(output).toContain('localhost:6379');
    expect(output).toContain('cache adapter selected');
    expect(output).not.toContain('S3cret');

    await cache.close().catch(() => undefined);
  });

  it('sanitizes Redis targets without credentials', () => {
    expect(sanitizeRedisTarget('redis://user:S3cret@localhost:6379/0')).toBe('localhost:6379');
    expect(sanitizeRedisTarget('redis://cache.internal:6380')).toBe('cache.internal:6380');
    expect(sanitizeRedisTarget('not a url')).toBe('invalid-url');
  });

  it('documents the reserved permission-cache key convention', () => {
    const reservedKey = 'user:00000000-0000-0000-0000-000000000000:permissions';

    expect(reservedKey).toMatch(/^user:.+:permissions$/);
  });
});
