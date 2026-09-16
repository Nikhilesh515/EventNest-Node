import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../../../src/config/env.js';

const BASE_ENV: NodeJS.ProcessEnv = {
  JWT_SECRET: 'test-secret-value-0123456789abcdef',
};

describe('loadConfig — auth cookie settings', () => {
  it('leaves COOKIE_SECURE undefined by default and defaults the grace window to 30s', () => {
    const config = loadConfig({ ...BASE_ENV });

    expect(config.COOKIE_SECURE).toBeUndefined();
    expect(config.REFRESH_ROTATION_GRACE_SECONDS).toBe(30);
  });

  it('parses COOKIE_SECURE=true and =1 as true', () => {
    expect(loadConfig({ ...BASE_ENV, COOKIE_SECURE: 'true' }).COOKIE_SECURE).toBe(true);
    expect(loadConfig({ ...BASE_ENV, COOKIE_SECURE: '1' }).COOKIE_SECURE).toBe(true);
  });

  it('parses COOKIE_SECURE=false and =0 as false', () => {
    expect(loadConfig({ ...BASE_ENV, COOKIE_SECURE: 'false' }).COOKIE_SECURE).toBe(false);
    expect(loadConfig({ ...BASE_ENV, COOKIE_SECURE: '0' }).COOKIE_SECURE).toBe(false);
  });

  it('accepts a zero-second grace window', () => {
    const config = loadConfig({ ...BASE_ENV, REFRESH_ROTATION_GRACE_SECONDS: '0' });

    expect(config.REFRESH_ROTATION_GRACE_SECONDS).toBe(0);
  });

  it('rejects a negative grace window', () => {
    expect(() => loadConfig({ ...BASE_ENV, REFRESH_ROTATION_GRACE_SECONDS: '-1' })).toThrow(
      ConfigError,
    );
  });

  it('rejects a non-numeric grace window', () => {
    expect(() => loadConfig({ ...BASE_ENV, REFRESH_ROTATION_GRACE_SECONDS: 'soon' })).toThrow(
      ConfigError,
    );
  });

  it('rejects an invalid COOKIE_SECURE value', () => {
    expect(() => loadConfig({ ...BASE_ENV, COOKIE_SECURE: 'yes' })).toThrow(ConfigError);
  });
});
