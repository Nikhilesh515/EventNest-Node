import type { Server } from 'node:http';
import type { Logger } from 'pino';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { testConfig } from '../../helpers/app.js';
import { createLogger } from '../../../src/shared/infrastructure/logger.js';
import { exitAfterFlush } from '../../../src/shared/infrastructure/exit.js';
import { registerShutdownHandlers } from '../../../src/shared/infrastructure/shutdown.js';

function fakeLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: vi.fn(),
  } as unknown as Logger & {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    flush: ReturnType<typeof vi.fn>;
  };
}

function captureAddedListeners(signal: NodeJS.Signals): () => void {
  const before = process.listeners(signal);
  return () => {
    for (const listener of process.listeners(signal)) {
      if (!before.includes(listener)) {
        process.removeListener(signal, listener);
      }
    }
  };
}

describe('Logger factory', () => {
  it('builds a production logger with the configured level', () => {
    const logger = createLogger(testConfig({ NODE_ENV: 'production', LOG_LEVEL: 'warn' }));

    expect(logger.level).toBe('warn');
    expect(typeof logger.info).toBe('function');
  });

  it('builds a development logger without throwing', () => {
    const logger = createLogger(testConfig({ NODE_ENV: 'development' }));

    expect(typeof logger.info).toBe('function');
  });
});

describe('exitAfterFlush', () => {
  afterEach(() => {
    process.exitCode = undefined;
    vi.restoreAllMocks();
  });

  it('sets the exit code, flushes logs, and exits after the fallback delay', () => {
    vi.useFakeTimers();
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const logger = fakeLogger();

    exitAfterFlush(logger, 3);

    expect(process.exitCode).toBe(3);
    expect(logger.flush).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(300);
    expect(exit).toHaveBeenCalledWith(3);
    vi.useRealTimers();
  });
});

describe('registerShutdownHandlers', () => {
  afterEach(() => {
    process.exitCode = undefined;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('drains the server, logs completion, and exits 0 on SIGINT', () => {
    vi.useFakeTimers();
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const cleanupSigint = captureAddedListeners('SIGINT');
    const cleanupSigterm = captureAddedListeners('SIGTERM');
    const closeCallbacks: Array<(error?: Error) => void> = [];
    const server = {
      close: (callback: (error?: Error) => void) => {
        closeCallbacks.push(callback);
      },
    } as unknown as Server;
    const logger = fakeLogger();

    registerShutdownHandlers(server, logger);
    process.emit('SIGINT', 'SIGINT');

    expect(logger.info).toHaveBeenCalledWith(
      { signal: 'SIGINT' },
      'shutdown signal received; draining connections',
    );

    closeCallbacks[0]?.();

    expect(logger.info).toHaveBeenCalledWith('shutdown complete');
    vi.advanceTimersByTime(300);
    expect(exit).toHaveBeenCalledWith(0);

    cleanupSigint();
    cleanupSigterm();
  });

  it('forces exit 1 when the server does not close in time', () => {
    vi.useFakeTimers();
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const cleanupSigint = captureAddedListeners('SIGINT');
    const cleanupSigterm = captureAddedListeners('SIGTERM');
    const server = { close: () => undefined } as unknown as Server;
    const logger = fakeLogger();

    registerShutdownHandlers(server, logger);
    process.emit('SIGTERM', 'SIGTERM');
    vi.advanceTimersByTime(10_000);

    expect(logger.warn).toHaveBeenCalledWith('graceful shutdown timed out; forcing exit');

    vi.advanceTimersByTime(300);
    expect(exit).toHaveBeenCalledWith(1);

    cleanupSigint();
    cleanupSigterm();
  });

  it('ignores repeated signals while shutting down', () => {
    vi.useFakeTimers();
    vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const cleanupSigint = captureAddedListeners('SIGINT');
    const cleanupSigterm = captureAddedListeners('SIGTERM');
    const server = { close: () => undefined } as unknown as Server;
    const logger = fakeLogger();

    registerShutdownHandlers(server, logger);
    process.emit('SIGINT', 'SIGINT');
    process.emit('SIGINT', 'SIGINT');

    expect(logger.info).toHaveBeenCalledTimes(1);

    cleanupSigint();
    cleanupSigterm();
  });

  it('logs and exits 1 when the http server fails to close', () => {
    vi.useFakeTimers();
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const cleanupSigint = captureAddedListeners('SIGINT');
    const cleanupSigterm = captureAddedListeners('SIGTERM');
    const closeError = new Error('close failed');
    const server = {
      close: (callback: (error?: Error) => void) => {
        callback(closeError);
      },
    } as unknown as Server;
    const logger = fakeLogger();

    registerShutdownHandlers(server, logger);
    process.emit('SIGTERM', 'SIGTERM');

    expect(logger.error).toHaveBeenCalledWith(
      { err: closeError },
      'error while closing the http server',
    );
    vi.advanceTimersByTime(300);
    expect(exit).toHaveBeenCalledWith(1);

    cleanupSigint();
    cleanupSigterm();
  });

  it('logs cleanup failures and exits 1', async () => {
    vi.useFakeTimers();
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const cleanupSigint = captureAddedListeners('SIGINT');
    const cleanupSigterm = captureAddedListeners('SIGTERM');
    let closeCallback: ((error?: Error) => void) | undefined;
    const server = {
      close: (callback: (error?: Error) => void) => {
        closeCallback = callback;
      },
    } as unknown as Server;
    const logger = fakeLogger();
    const cleanupError = new Error('cleanup failed');
    const cleanup = vi.fn().mockRejectedValue(cleanupError);

    registerShutdownHandlers(server, logger, cleanup);
    process.emit('SIGINT', 'SIGINT');
    closeCallback?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(logger.error).toHaveBeenCalledWith({ err: cleanupError }, 'error during cleanup');
    vi.advanceTimersByTime(300);
    expect(exit).toHaveBeenCalledWith(1);

    cleanupSigint();
    cleanupSigterm();
  });
});
