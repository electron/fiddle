import { MessageChannelMain } from 'electron';

import { FileTransformOperation, Files } from '../../interfaces';
import { IpcEvents } from '../../ipc-events';
import { ipcMainManager } from '../ipc';

/**
 * Gets file content from the renderer
 */
export function getFiles(
  window: Electron.BrowserWindow,
  transforms: Array<FileTransformOperation>,
): Promise<{ localPath?: string; files: Files }> {
  return new Promise((resolve) => {
    const { port1, port2 } = new MessageChannelMain();
    ipcMainManager.postMessage(
      IpcEvents.GET_FILES,
      { options: undefined, transforms },
      [port1],
      window.webContents,
    );
    port2.once('message', (event) => {
      resolve(event.data);
      port2.close();
    });
    port2.start();
  });
}
