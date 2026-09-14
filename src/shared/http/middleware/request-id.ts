import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

const MAX_LENGTH = 128;
const PRINTABLE = /^[\x20-\x7e]+$/;

export function requestId(): RequestHandler {
  return (req, res, next) => {
    const inbound = req.header(REQUEST_ID_HEADER);
    const id =
      inbound && inbound.length <= MAX_LENGTH && PRINTABLE.test(inbound) ? inbound : randomUUID();
    req.id = id;
    res.setHeader('X-Request-Id', id);
    next();
  };
}
