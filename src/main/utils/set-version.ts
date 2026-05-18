import { MessageChannelMain } from 'electron';

import { IpcEvents } from '../../ipc-events';
import { ipcMainManager } from '../ipc';

/**
 * Asks the renderer to update `appState`'s active Electron version.
 * Resolves once the renderer has finished setting the version.
 */
export function setVersion(
  webContents: Electron.WebContents,
  version: string,
): Promise<void> {
  return new Promise((resolve) => {
    const { port1, port2 } = new MessageChannelMain();
    ipcMainManager.postMessage(
      IpcEvents.SET_VERSION,
      version,
      [port1],
      webContents,
    );
    port2.once('message', () => {
      resolve();
      port2.close();
    });
    port2.start();
  });
}
