import type { Request } from 'express';

export function getRequestId(request: Request): string | undefined {
  const candidate = (request as Request & { id?: unknown }).id;
  return typeof candidate === 'string' ? candidate : undefined;
}
