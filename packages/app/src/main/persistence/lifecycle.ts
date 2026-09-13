/**
 * Flushes every JSON store before the app goes away (REQUIREMENTS §5):
 * quit is held until the flush finishes, and a window's `session-end`
 * (Windows log-off) and `powerMonitor` `shutdown` flush too. Call once,
 * after `app.whenReady()`.
 */
import { app, powerMonitor } from 'electron';

import { log } from '../log';
import { flushAll } from './json-store';

export function installFlushOnExit(): void {
  let flushed = false;
  const flushThenQuit = () => {
    flushAll()
      .catch((error: unknown) => log.error('flush on exit failed', error))
      .finally(() => {
        flushed = true;
        app.quit();
      });
  };

  // `will-quit` comes after every window has closed, so state written while
  // windows close is included.
  app.on('will-quit', (event) => {
    if (flushed) return;
    event.preventDefault();
    flushThenQuit();
  });
  app.on('browser-window-created', (_event, window) => {
    window.on('session-end', () => {
      void flushAll();
    });
  });
  powerMonitor.on('shutdown', flushThenQuit);
}
