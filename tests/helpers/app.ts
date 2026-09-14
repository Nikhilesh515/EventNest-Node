import { pino, type Logger } from 'pino';
import { loadConfig, type AppConfig } from '../../src/config/env.js';

export function testConfig(overrides: Record<string, string> = {}): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-value-0123456789abcdef',
    LOG_LEVEL: 'silent',
    ...overrides,
  } as NodeJS.ProcessEnv);
}

export function testLogger(): Logger {
  return pino({ level: 'silent' });
}
