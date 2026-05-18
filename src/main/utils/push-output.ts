import type { WebContents } from 'electron';

import { IpcEvents } from '../../ipc-events';
import { ipcMainManager } from '../ipc';

/**
 * Push to the renderer's run output.
 */
export function pushOutput(
  webContents: WebContents,
  message: string,
  options?: { isNotPre?: boolean },
): void {
  ipcMainManager.send(
    IpcEvents.FIDDLE_RUNNER_OUTPUT,
    [message, options],
    webContents,
  );
}

/**
 * Push a line to the renderer's run output.
 */
export function pushOutputLine(
  webContents: WebContents,
  message: string,
  options?: { isNotPre?: boolean },
): void {
  pushOutput(webContents, `${message}\n`, options);
}

/**
 * Little convenience method that pushes message and error.
 */
export function pushError(
  webContents: WebContents,
  message: string,
  error: Error,
) {
  pushOutput(webContents, `⚠️ ${message}. Error encountered:`);
  pushOutput(webContents, error.toString());
  console.warn(error);
}
