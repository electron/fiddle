import { EventEmitter } from 'node:events';

import { MessagePortMain, ipcMain } from 'electron';

import { getOrCreateMainWindow } from './windows';
import {
  IpcEvents,
  WEBCONTENTS_READY_FOR_IPC_SIGNAL,
  ipcMainEvents,
} from '../ipc-events';

/**
 * The main purpose of this class is to be the central
 * gathering place for IPC calls the main process sends
 * or listens to.
 */
class IpcMainManager extends EventEmitter {
  public readyWebContents = new WeakSet<Electron.WebContents>();
  private messageQueue = new WeakMap<
    Electron.WebContents,
    Array<[IpcEvents, Array<any> | undefined]>
  >();

  constructor() {
    super();

    ipcMainEvents.forEach((name) => {
      ipcMain.removeAllListeners(name);
      ipcMain.on(name, (...args: Array<any>) => this.emit(name, ...args));
    });

    ipcMain.on(
      WEBCONTENTS_READY_FOR_IPC_SIGNAL,
      (event: Electron.IpcMainEvent) => {
        this.readyWebContents.add(event.sender);

        const queue = this.messageQueue.get(event.sender);
        this.messageQueue.delete(event.sender);
        if (!queue) return;
        for (const item of queue) {
          this.send(item[0], item[1], event.sender);
        }
      },
    );
  }

  /**
   * Send an IPC message to an instance of Electron.WebContents.
   * If none is specified, we'll automatically go with the main window.
   */
  public send(
    channel: IpcEvents,
    args?: Array<any>,
    target?: Electron.WebContents,
  ) {
    const _target = target;
    if (!_target) {
      getOrCreateMainWindow().then((window) => {
        this.send(channel, args, window.webContents);
      });
      return;
    }

    const _args = args || [];
    if (!this.readyWebContents.has(_target)) {
      const existing = this.messageQueue.get(_target) || [];
      this.messageQueue.set(_target, [...existing, [channel, args]]);
      return;
    }

    _target.isDestroyed() || _target.send(channel, ..._args);
  }

  public handle(
    channel: IpcEvents,
    listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any,
  ) {
    // there can be only one, so remove previous one first
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, listener);
  }

  public handleOnce(
    channel: IpcEvents,
    listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any,
  ) {
    ipcMain.handleOnce(channel, listener);
  }

  public postMessage(
    channel: IpcEvents,
    message: any,
    transfer?: MessagePortMain[],
    target?: Electron.WebContents,
  ) {
    const _target = target;
    if (!_target) {
      getOrCreateMainWindow().then((window) => {
        window.webContents.postMessage(channel, message, transfer);
      });
      return;
    }
    _target.postMessage(channel, message, transfer);
  }
}

export const ipcMainManager = new IpcMainManager();
