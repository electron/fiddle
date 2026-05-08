import { EventEmitter } from 'node:events';

import { BrowserWindow, MessagePortMain, ipcMain } from 'electron';

import { getOrCreateMainWindow } from './windows';
import {
  IpcEvents,
  IpcMainEvent,
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
      ipcMain.on(name, (event: Electron.IpcMainEvent, ...args: Array<any>) => {
        // Only accept messages from BrowserWindows created by the app.
        // This rejects IPC from WebViews, sub-frames, or detached windows.
        if (!BrowserWindow.fromWebContents(event.sender)) return;
        this.emit(name, event, ...args);
      });
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

  override on(event: IpcMainEvent, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  override off(event: IpcMainEvent, listener: (...args: any[]) => void): this {
    return super.off(event, listener);
  }

  override once(event: IpcMainEvent, listener: (...args: any[]) => void): this {
    return super.once(event, listener);
  }

  override emit(event: IpcMainEvent, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }

  override removeAllListeners(event?: IpcMainEvent): this {
    return super.removeAllListeners(event);
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
    ipcMain.handle(
      channel,
      (event: Electron.IpcMainInvokeEvent, ...args: any[]) => {
        // Only accept messages from BrowserWindows created by the app.
        // This rejects IPC from WebViews, sub-frames, or detached windows.
        if (!BrowserWindow.fromWebContents(event.sender)) return;
        return listener(event, ...args);
      },
    );
  }

  public handleOnce(
    channel: IpcEvents,
    listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any,
  ) {
    ipcMain.handleOnce(
      channel,
      (event: Electron.IpcMainInvokeEvent, ...args: any[]) => {
        if (!BrowserWindow.fromWebContents(event.sender)) return;
        return listener(event, ...args);
      },
    );
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
