/**
 * "Closing the last window quits the app, except on macOS" (REQUIREMENTS
 * §17.16).
 *
 * The handler is installed right after `ready`, before the one-time import.
 * The import's hidden reader window (../migration/local-storage.ts) is the
 * only window while it exists, and destroying it emits `window-all-closed`.
 * Without a listener Electron would quit; with a plain "quit unless macOS"
 * listener, Linux and Windows would quit too. So the event is ignored until
 * startup has finished: before that, only hidden helper windows can close.
 */
import { app } from 'electron';

let starting = true;

export function installQuitOnLastWindowClosed(platform: NodeJS.Platform = process.platform): void {
  app.on('window-all-closed', () => {
    if (platform !== 'darwin' && !starting) app.quit();
  });
}

/** App windows may open from now on; closing the last one quits (outside macOS). */
export function finishStartup(): void {
  starting = false;
}
