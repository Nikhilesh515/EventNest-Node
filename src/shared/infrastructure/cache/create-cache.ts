import { Redis } from 'ioredis';
import type { Logger } from 'pino';
import type { AppConfig } from '../../../config/env.js';
import type { CachePort } from '../../application/ports/cache-port.js';
import { MemoryCacheAdapter } from './memory-cache.js';
import { RedisCacheAdapter } from './redis-cache.js';

export function sanitizeRedisTarget(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || '6379'}`;
  } catch {
    return 'invalid-url';
  }
}

export function createRedisClient(url: string, logger: Logger): Redis {
  const client = new Redis(url, {
    connectTimeout: 2000,
    commandTimeout: 1000,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
  });
  client.on('error', (error) => logger.warn({ err: error }, 'redis connection error'));
  return client;
}

export function createCache(config: AppConfig, logger: Logger): CachePort {
  const ttlSeconds = config.CACHE_TTL_MINUTES * 60;

  if (!config.REDIS_URL) {
    logger.info({ adapter: 'memory' }, 'cache adapter selected');
    return new MemoryCacheAdapter(ttlSeconds);
  }

  logger.info(
    { adapter: 'redis', target: sanitizeRedisTarget(config.REDIS_URL) },
    'cache adapter selected',
  );
  return new RedisCacheAdapter(createRedisClient(config.REDIS_URL, logger), ttlSeconds);
}
