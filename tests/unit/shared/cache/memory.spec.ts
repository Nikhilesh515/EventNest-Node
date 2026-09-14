import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../../../src/config/env.js';
import { MemoryCacheAdapter } from '../../../../src/shared/infrastructure/cache/memory-cache.js';

const BASE_ENV = {
  NODE_ENV: 'test',
  JWT_SECRET: 'test-secret-value-0123456789abcdef',
} as NodeJS.ProcessEnv;

describe('TC-CORE-041: default and explicit TTL', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the configured default TTL when omitted', async () => {
    const adapter = new MemoryCacheAdapter(5 * 60);

    await adapter.set('k', 'v');
    vi.advanceTimersByTime(5 * 60 * 1000 - 1);
    expect(await adapter.get('k')).toBe('v');

    vi.advanceTimersByTime(1);
    expect(await adapter.get('k')).toBeNull();

    await adapter.close();
  });

  it('honors an explicit TTL override', async () => {
    const adapter = new MemoryCacheAdapter(300);

    await adapter.set('k2', 'v2', 1);
    vi.advanceTimersByTime(1001);
    expect(await adapter.get('k2')).toBeNull();

    await adapter.close();
  });

  it('validates CACHE_TTL_MINUTES and defaults it to 5', () => {
    expect(loadConfig({ ...BASE_ENV }).CACHE_TTL_MINUTES).toBe(5);
    expect(loadConfig({ ...BASE_ENV, CACHE_TTL_MINUTES: '10' }).CACHE_TTL_MINUTES).toBe(10);
    expect(() => loadConfig({ ...BASE_ENV, CACHE_TTL_MINUTES: '0' })).toThrow();
    expect(() => loadConfig({ ...BASE_ENV, CACHE_TTL_MINUTES: '2.5' })).toThrow();
  });
});

describe('TC-CORE-042: expiry, re-set, and close', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('treats expired entries as misses and restarts TTL on re-set', async () => {
    const adapter = new MemoryCacheAdapter(300);

    await adapter.set('k', 'a', 10);
    vi.advanceTimersByTime(10_001);
    expect(await adapter.get('k')).toBeNull();

    await adapter.set('k', 'a', 10);
    vi.advanceTimersByTime(5_000);
    await adapter.set('k', 'b', 10);
    vi.advanceTimersByTime(6_000);
    expect(await adapter.get('k')).toBe('b');
    vi.advanceTimersByTime(5_000);
    expect(await adapter.get('k')).toBeNull();

    await adapter.close();
  });

  it('clears the store on close', async () => {
    const adapter = new MemoryCacheAdapter(300, 10);

    await adapter.set('k', 'v');
    await adapter.close();

    expect(await adapter.get('k')).toBeNull();
  });

  it('unrefs the sweep timer so it never holds the event loop', () => {
    const unref = vi.fn();
    const handle = { unref } as unknown as NodeJS.Timeout;
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval').mockReturnValue(handle);

    new MemoryCacheAdapter(300, 10);

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(unref).toHaveBeenCalledTimes(1);

    setIntervalSpy.mockRestore();
  });
});
