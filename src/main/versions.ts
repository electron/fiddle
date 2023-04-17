import { MessageChannelMain } from 'electron';

import { IpcEvents } from '../ipc-events';
import { ipcMainManager } from './ipc';

// TODO(dsanders11): Remove this once Electron versions move to main process
export function isReleasedMajor(major: number): Promise<boolean> {
  return new Promise((resolve) => {
    const { port1, port2 } = new MessageChannelMain();
    ipcMainManager.postMessage(IpcEvents.IS_RELEASED_MAJOR, { major }, [port1]);
    port2.once('message', (event) => {
      resolve(event.data);
      port2.close();
    });
    port2.start();
  });
}
