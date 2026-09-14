import { pino, type Logger, type LoggerOptions } from 'pino';
import type { AppConfig } from '../../config/env.js';

export function createLogger(config: AppConfig): Logger {
  const options: LoggerOptions = {
    level: config.LOG_LEVEL,
    base: { service: 'eventnest-api' },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (config.NODE_ENV === 'development') {
    options.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss',
        ignore: 'pid,hostname,service',
      },
    };
  }

  return pino(options);
}
