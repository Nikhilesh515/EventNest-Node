import helmet from 'helmet';
import type { RequestHandler } from 'express';

export function securityHeaders(): RequestHandler {
  return helmet();
}
