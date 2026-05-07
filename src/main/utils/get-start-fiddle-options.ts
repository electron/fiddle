import { MessageChannelMain } from 'electron';

import { StartFiddleOptions } from '../../interfaces';
import { IpcEvents } from '../../ipc-events';
import { ipcMainManager } from '../ipc';

/**
 * Asks the renderer for everything the main process needs to run the
 * current fiddle (version, env, modules, packageManager, etc.).
 */
export function getStartFiddleOptions(
  webContents: Electron.WebContents,
): Promise<StartFiddleOptions> {
  return new Promise((resolve) => {
    const { port1, port2 } = new MessageChannelMain();
    ipcMainManager.postMessage(
      IpcEvents.GET_START_FIDDLE_OPTIONS,
      undefined,
      [port1],
      webContents,
    );
    port2.once('message', (event) => {
      resolve(event.data as StartFiddleOptions);
      port2.close();
    });
    port2.start();
  });
}
