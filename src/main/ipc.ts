import { EventEmitter } from 'events';
import { ipcMain } from 'electron';
import { ipcMainEvents, IpcEvents } from '../ipc-events';
import { getOrCreateMainWindow } from './windows';

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

  /**
   * Send an IPC message to an instance of Electron.WebContents.
   * If none is specified, we'll automatically go with the main window.
   *
   * @param {IpcEvents} channel
   * @param {Array<any>} args
   * @param {Electron.WebContents} [target]
   */
  public send(channel: IpcEvents, args?: Array<any>, target?: Electron.WebContents) {
    const _target = target || getOrCreateMainWindow().webContents;
    const _args = args || [];

    _target.send(channel, ..._args);
  }
}

export const ipcMainManager = new IpcMainManager();
