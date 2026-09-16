import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { healthHandler } from '../../../src/shared/http/health.js';

function fakeResponse() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

function fakeKnex(behaviour: () => Promise<unknown>) {
  return { raw: vi.fn(behaviour) } as never;
}

describe('healthHandler', () => {
  it('reports 503 with Unhealthy when postgres is down', async () => {
    const res = fakeResponse();
    const next = vi.fn() as unknown as NextFunction;
    const handler = healthHandler({
      knex: fakeKnex(() => Promise.reject(new Error('db down'))),
      redisClient: null,
    });

    await handler({} as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    const body = res.json.mock.calls[0]?.[0] as {
      status: string;
      checks: { name: string; status: string }[];
    };
    expect(body.status).toBe('Unhealthy');
    expect(body.checks.find((c) => c.name === 'postgres')?.status).toBe('Unhealthy');
    expect(body.checks.find((c) => c.name === 'redis')?.status).toBe('Skipped');
  });

  it('reports Unhealthy when redis responds without PONG', async () => {
    const res = fakeResponse();
    const next = vi.fn() as unknown as NextFunction;
    const handler = healthHandler({
      knex: fakeKnex(() => Promise.resolve(1)),
      redisClient: { ping: () => Promise.resolve('nope') },
    });

    await handler({} as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    const body = res.json.mock.calls[0]?.[0] as { checks: { name: string; status: string }[] };
    expect(body.checks.find((c) => c.name === 'redis')?.status).toBe('Unhealthy');
  });

  it('reports Healthy when both dependencies respond', async () => {
    const res = fakeResponse();
    const next = vi.fn() as unknown as NextFunction;
    const handler = healthHandler({
      knex: fakeKnex(() => Promise.resolve(1)),
      redisClient: { ping: () => Promise.resolve('PONG') },
    });

    await handler({} as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0]?.[0] as { status: string };
    expect(body.status).toBe('Healthy');
  });
});
