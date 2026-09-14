import type { Logger } from 'pino';

const FORCE_EXIT_MS = 250;

export function exitAfterFlush(logger: Logger, code: number): void {
  process.exitCode = code;
  logger.flush();
  setTimeout(() => process.exit(code), FORCE_EXIT_MS).unref();
}
