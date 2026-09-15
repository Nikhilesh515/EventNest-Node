import type { RequestHandler } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { fail } from '../respond.js';

export function buildRateLimiter(rateLimitPerMinute: number): RequestHandler {
  const limiter = new RateLimiterMemory({
    keyPrefix: 'global',
    points: rateLimitPerMinute,
    duration: 60,
  });

  return async (req, res, next) => {
    if (req.path === '/health') return next();
    try {
      await limiter.consume('global');
      next();
    } catch {
      res.setHeader('Retry-After', '60');
      fail(res, 429, 'Too many requests.', null);
    }
  };
}
