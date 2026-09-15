import type { RequestHandler } from 'express';
import type { Knex } from 'knex';

interface CheckResult {
  name: string;
  status: 'Healthy' | 'Unhealthy' | 'Skipped';
  durationMs: number;
}

async function probe(name: string, fn: () => Promise<void>): Promise<CheckResult> {
  const t = performance.now();
  try {
    await fn();
    return { name, status: 'Healthy', durationMs: Math.round(performance.now() - t) };
  } catch {
    return { name, status: 'Unhealthy', durationMs: Math.round(performance.now() - t) };
  }
}

export interface HealthDeps {
  knex: Knex;
  redisClient: { ping(): Promise<string> } | null;
}

export function healthHandler(deps: HealthDeps): RequestHandler {
  return async (_req, res) => {
    const checks = await Promise.all([
      probe('postgres', async () => {
        await deps.knex.raw('SELECT 1');
      }),
      probe('redis', async () => {
        if (!deps.redisClient) throw new Error('not configured');
        const pong = await deps.redisClient.ping();
        if (pong !== 'PONG') throw new Error('no pong');
      }),
    ]);

    if (!deps.redisClient) {
      const redisCheck = checks.find((c) => c.name === 'redis');
      if (redisCheck) redisCheck.status = 'Skipped';
    }

    const healthy = checks.every((c) => c.status !== 'Unhealthy');
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'Healthy' : 'Unhealthy',
      checks,
    });
  };
}
