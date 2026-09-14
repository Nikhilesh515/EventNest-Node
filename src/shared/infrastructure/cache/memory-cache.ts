import type { CachePort } from '../../application/ports/cache-port.js';

interface Entry {
  raw: string;
  expiresAt: number | null;
}

export class MemoryCacheAdapter implements CachePort {
  private readonly store = new Map<string, Entry>();
  private readonly sweep: NodeJS.Timeout;

  constructor(
    private readonly defaultTtlSeconds: number,
    sweepIntervalMs = 60_000,
  ) {
    this.sweep = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store) {
        if (entry.expiresAt !== null && now >= entry.expiresAt) {
          this.store.delete(key);
        }
      }
    }, sweepIntervalMs);
    this.sweep.unref();
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt !== null && Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return JSON.parse(entry.raw) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds = this.defaultTtlSeconds): Promise<void> {
    this.store.set(key, {
      raw: JSON.stringify(value),
      expiresAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null,
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async close(): Promise<void> {
    clearInterval(this.sweep);
    this.store.clear();
  }
}
