import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { readCookie } from '../../../src/shared/http/cookies.js';

function buildApp() {
  const app = express();
  app.get('/cookie', (req, res) => {
    res.json({
      session: readCookie(req, 'session'),
      other: readCookie(req, 'other'),
      missing: readCookie(req, 'absent'),
    });
  });
  return app;
}

describe('readCookie', () => {
  it('reads a single cookie value', async () => {
    const res = await request(buildApp()).get('/cookie').set('Cookie', 'session=abc123');

    expect(res.body.session).toBe('abc123');
  });

  it('reads the right cookie from a multi-cookie header', async () => {
    const res = await request(buildApp())
      .get('/cookie')
      .set('Cookie', 'theme=dark; session=abc123; other=xyz');

    expect(res.body.session).toBe('abc123');
    expect(res.body.other).toBe('xyz');
  });

  it('ignores whitespace around names and values', async () => {
    const res = await request(buildApp()).get('/cookie').set('Cookie', '  session = abc123  ');

    expect(res.body.session).toBe('abc123');
  });

  it('decodes URL-encoded values', async () => {
    const res = await request(buildApp()).get('/cookie').set('Cookie', 'session=a%20b%2Fc');

    expect(res.body.session).toBe('a b/c');
  });

  it('returns null when the header is missing', async () => {
    const res = await request(buildApp()).get('/cookie');

    expect(res.body.session).toBeNull();
  });

  it('returns null when the name is absent', async () => {
    const res = await request(buildApp()).get('/cookie').set('Cookie', 'theme=dark; other=xyz');

    expect(res.body.session).toBeNull();
  });

  it('skips malformed segments without separators', async () => {
    const res = await request(buildApp()).get('/cookie').set('Cookie', 'broken; session=abc123');

    expect(res.body.session).toBe('abc123');
  });

  it('returns null when the value is malformed percent-encoding', async () => {
    const res = await request(buildApp()).get('/cookie').set('Cookie', 'session=%E0%A4%A');

    expect(res.body.session).toBeNull();
  });

  it('does not match a name that is a prefix of another', async () => {
    const res = await request(buildApp()).get('/cookie').set('Cookie', 'session_extra=oops');

    expect(res.body.session).toBeNull();
  });
});
