import { app, powerMonitor } from 'electron';

import { flushLog, log } from '../log';
import { flushAll, hasPendingWrites } from './json-store';

/** A write that hangs (a network drive, say) must not keep the app from quitting. */
const FLUSH_TIMEOUT_MS = 5000;

/** `flushDocuments` writes what is still waiting on a timer, such as drafts, before a log off or shutdown. */
export function installFlushOnExit(flushDocuments: () => void): void {
  let gaveUp = false;

  const flushWithinLimit = async (): Promise<void> => {
    const timeout = new Promise<'timeout'>((resolve) =>
      setTimeout(resolve, FLUSH_TIMEOUT_MS, 'timeout').unref(),
    );
    try {
      if ((await Promise.race([flushAll(), timeout])) === 'timeout') {
        gaveUp = true;
        log.error('flush on exit timed out');
      }
    } catch (error) {
      log.error('flush on exit failed', error);
    }
    await flushLog();
  };

  // `app.quit()` runs on a later turn, never inside a quit event's own
  // dispatch, where Electron would drop it.
  const flushThenQuit = () => {
    void flushWithinLimit().finally(() => setImmediate(() => app.quit()));
  };

  // `will-quit` comes after every window has closed, so state written while
  // windows close is included. Once nothing is pending, the quit goes ahead.
  app.on('will-quit', (event) => {
    if (gaveUp || !hasPendingWrites()) return;
    event.preventDefault();
    flushThenQuit();
  });
  app.on('browser-window-created', (_event, window) => {
    window.on('session-end', () => {
      flushDocuments();
      void flushAll();
    });
  });
  // The system waits for the flush only if the handler calls `preventDefault`,
  // which Electron's typings leave out.
  const onShutdown = (event: { preventDefault(): void }) => {
    event.preventDefault();
    flushDocuments();
    flushThenQuit();
  };
  powerMonitor.on('shutdown', onShutdown as () => void);
}
