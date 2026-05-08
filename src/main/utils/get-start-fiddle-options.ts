import { MessageChannelMain } from 'electron';

import { StartFiddleOptions } from '../../interfaces';
import { IpcEvents } from '../../ipc-events';
import { ipcMainManager } from '../ipc';

/**
 * Asks the renderer for everything the main process needs to run the
 * current fiddle (version, env, modules, packageManager, etc.).
 *
 * Rejects if the renderer throws while building the options.
 */
export function getStartFiddleOptions(
  webContents: Electron.WebContents,
): Promise<StartFiddleOptions> {
  return new Promise((resolve, reject) => {
    const { port1, port2 } = new MessageChannelMain();
    ipcMainManager.postMessage(
      IpcEvents.GET_START_FIDDLE_OPTIONS,
      undefined,
      [port1],
      webContents,
    );
    port2.once('message', (event) => {
      port2.close();
      const data = event.data as
        | { result: StartFiddleOptions }
        | { error: string };
      if ('error' in data) {
        reject(new Error(data.error));
      } else {
        resolve(data.result);
      }
    });
    port2.start();
  });
}
