/**
 * `window-all-closed` is ignored until startup has finished: the import's hidden
 * reader window is the only window until then, and destroying it would quit
 * Linux and Windows.
 */
import { app } from 'electron';

let starting = true;

export function installQuitOnLastWindowClosed(
  platform: NodeJS.Platform = process.platform,
): void {
  app.on('window-all-closed', () => {
    if (platform !== 'darwin' && !starting) app.quit();
  });
}

/** App windows may open from now on; closing the last one quits (outside macOS). */
export function finishStartup(): void {
  starting = false;
}
