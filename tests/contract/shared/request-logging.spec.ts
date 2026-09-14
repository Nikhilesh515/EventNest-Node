import { Writable } from 'node:stream';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../src/app.js';
import { testConfig } from '../../helpers/app.js';
import { buildTestRouter } from '../../helpers/test-router.js';

function buildAppWithCapture() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(String(chunk));
      callback();
    },
  });
  const logger = pino({ level: 'info' }, stream);
  const app = createApp({ config: testConfig(), logger, router: buildTestRouter() });
  return { app, lines };
}

function parseEntries(lines: string[]): Array<Record<string, unknown>> {
  return lines
    .join('')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe('TC-CORE-054: req.log carries the request id', () => {
  it('binds handler log lines to the same request id as the response header', async () => {
    const { app, lines } = buildAppWithCapture();

    const res = await request(app).get('/api/_test/log').set('X-Request-Id', 'log-correlation-1');
    await new Promise((resolve) => setImmediate(resolve));

    expect(res.headers['x-request-id']).toBe('log-correlation-1');

    const entries = parseEntries(lines);
    const entry = entries.find((candidate) => candidate['marker'] === 'route-log');
    expect(entry).toBeDefined();
    expect(entry?.['msg']).toBe('handled');

    const req = entry?.['req'] as Record<string, unknown> | undefined;
    expect(req?.['id']).toBe('log-correlation-1');
  });
});
