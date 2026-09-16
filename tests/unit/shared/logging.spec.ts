import { Writable } from 'node:stream';
import express from 'express';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { requestId } from '../../../src/shared/http/middleware/request-id.js';
import { requestLogger } from '../../../src/shared/http/middleware/request-logger.js';

function buildLoggingApp() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(String(chunk));
      callback();
    },
  });
  const logger = pino({ level: 'info' }, stream);

  const app = express();
  app.use(requestId());
  app.use(requestLogger(logger));
  app.use(express.json());

  app.get('/ok', (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.get('/missing', (_req, res) => {
    res.status(404).json({});
  });
  app.get('/boom', (_req, res) => {
    res.status(500).json({});
  });
  app.post('/secret', (_req, res) => {
    res.setHeader('set-cookie', 'session=abc');
    res.status(200).json({});
  });

  return { app, lines };
}

function parseEntries(lines: string[]): Array<Record<string, unknown>> {
  return lines
    .join('')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

const FLUSH = () => new Promise((resolve) => setImmediate(resolve));

describe('TC-CORE-052: pino-http fields and level selection', () => {
  it('logs method, url, status, response time, and request id with status-based levels', async () => {
    const { app, lines } = buildLoggingApp();

    await request(app).get('/ok');
    await request(app).get('/missing');
    await request(app).get('/boom');
    await FLUSH();

    const entries = parseEntries(lines);
    const ok = entries.find((entry) => (entry['req'] as Record<string, unknown>)['url'] === '/ok');
    const missing = entries.find(
      (entry) => (entry['req'] as Record<string, unknown>)['url'] === '/missing',
    );
    const boom = entries.find(
      (entry) => (entry['req'] as Record<string, unknown>)['url'] === '/boom',
    );

    expect(ok).toBeDefined();
    expect(missing).toBeDefined();
    expect(boom).toBeDefined();

    const okReq = ok?.['req'] as Record<string, unknown>;
    const okRes = ok?.['res'] as Record<string, unknown>;
    expect(okReq['method']).toBe('GET');
    expect(okReq['url']).toBe('/ok');
    expect(typeof okReq['id']).toBe('string');
    expect(okRes['statusCode']).toBe(200);
    expect(typeof ok?.['responseTime']).toBe('number');

    expect(ok?.['level']).toBe(30);
    expect(missing?.['level']).toBe(40);
    expect(boom?.['level']).toBe(50);
  });
});

describe('TC-CORE-053: Secrets are redacted in logs', () => {
  it('censors authorization headers, cookies, and secret body fields', async () => {
    const { app, lines } = buildLoggingApp();

    await request(app)
      .post('/secret')
      .set('Authorization', 'Bearer SUPER_SECRET_TOKEN')
      .set('Cookie', 'eventnest.refresh_token=RT_SECRET')
      .send({ password: 'P@ssw0rd' });
    await FLUSH();

    const output = lines.join('');

    expect(output).toContain('[Redacted]');
    expect(output).not.toContain('SUPER_SECRET_TOKEN');
    expect(output).not.toContain('RT_SECRET');
    expect(output).not.toContain('P@ssw0rd');
    expect(output).not.toContain('session=abc');
  });
});
