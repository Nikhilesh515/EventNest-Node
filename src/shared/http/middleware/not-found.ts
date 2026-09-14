import type { RequestHandler } from 'express';
import { fail } from '../respond.js';

export function notFound(): RequestHandler {
  return (_req, res) => {
    fail(res, 404, 'Route not found.', null);
  };
}
