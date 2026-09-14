import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Logger } from 'pino';
import { pinoHttp, stdSerializers, type HttpLogger } from 'pino-http';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.refreshToken',
  'res.headers["set-cookie"]',
];

export function requestLogger(logger: Logger): HttpLogger {
  return pinoHttp({
    logger,
    genReqId: (req) => (typeof req.id === 'string' && req.id ? req.id : randomUUID()),
    serializers: {
      req: (req: IncomingMessage) => ({
        id: req.id,
        method: req.method,
        url: req.url,
        headers: req.headers,
      }),
      res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
      err: stdSerializers.err,
    },
    customLogLevel: (_req: IncomingMessage, res: ServerResponse, err?: Error) => {
      if (err || res.statusCode >= 500) {
        return 'error';
      }
      if (res.statusCode >= 400) {
        return 'warn';
      }
      return 'info';
    },
    redact: { paths: REDACT_PATHS, censor: '[Redacted]' },
  });
}
