import type { Server } from 'node:http';
import type { Logger } from 'pino';
import { exitAfterFlush } from './exit.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

export function registerShutdownHandlers(server: Server, logger: Logger): void {
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

    server.close((error) => {
      clearTimeout(forceExit);
      if (error) {
        logger.error({ err: error }, 'error while closing the http server');
        exitAfterFlush(logger, 1);
        return;
      }
      logger.info('shutdown complete');
      exitAfterFlush(logger, 0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
