import type { Server } from 'node:http';
import type { Logger } from 'pino';
import { exitAfterFlush } from './exit.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

export function registerShutdownHandlers(
  server: Server,
  logger: Logger,
  cleanup?: () => Promise<void>,
): void {
  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, 'shutdown signal received; draining connections');

    const forceExit = setTimeout(() => {
      logger.warn('graceful shutdown timed out; forcing exit');
      exitAfterFlush(logger, 1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    server.close(async (error) => {
      clearTimeout(forceExit);
      if (error) {
        logger.error({ err: error }, 'error while closing the http server');
        exitAfterFlush(logger, 1);
        return;
      }
      let cleanupFailed = false;
      if (cleanup) {
        try {
          await cleanup();
        } catch (err) {
          cleanupFailed = true;
          logger.error({ err }, 'error during cleanup');
        }
      }
      logger.info('shutdown complete');
      exitAfterFlush(logger, cleanupFailed ? 1 : 0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
