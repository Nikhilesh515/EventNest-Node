import compression from 'compression';
import type { RequestHandler } from 'express';

export function compress(): RequestHandler {
  return compression();
}
