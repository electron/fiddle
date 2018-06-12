import { EventEmitter } from 'events';
import { ipcMain } from 'electron';
import { ipcMainEvents } from '../ipc-events';

/**
 * The main purpose of this class is to be the central
 * gathering place for IPC calls the main process sends
 * or listens to.
 *
 * @class IpcManager
 * @extends {EventEmitter}
 */
export class IpcMainManager extends EventEmitter {
  constructor() {
    super();

    ipcMainEvents.forEach((name) => {
      ipcMain.on(name, (...args) => this.emit(name, ...args));
    });
  }
}

export const ipcMainManager = new IpcMainManager();
