import { EventEmitter } from 'node:events';

import {
  BrowserWindow,
  MessagePortMain,
  WebFrameMain,
  ipcMain,
} from 'electron';

import { getOrCreateMainWindow } from './windows';
import {
  IpcEvents,
  IpcMainEvent,
  WEBCONTENTS_READY_FOR_IPC_SIGNAL,
  ipcMainEvents,
} from '../ipc-events';

type IpcSendTarget = Electron.WebContents | WebFrameMain;

function isWebContents(target: IpcSendTarget): target is Electron.WebContents {
  return 'mainFrame' in target;
}

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
   * Send an IPC message to one or more targets — either a
   * `WebContents` (which sends to its main frame) or a
   * `WebFrameMain` (sends to that specific sub-frame). If no target
   * is provided, falls back to the main window. Targets may be a
   * single value or an array; nullish entries are skipped so callers
   * can pass results of optional lookups (e.g. a frame that
   * may not exist yet) without filtering first.
   */
  public send(
    channel: IpcEvents,
    args?: Array<any>,
    target?: IpcSendTarget | Array<IpcSendTarget | null | undefined> | null,
  ) {
    if (target === undefined || target === null) {
      getOrCreateMainWindow().then((window) => {
        this.send(channel, args, window.webContents);
      });
      return;
    }

    if (Array.isArray(target)) {
      for (const t of target) {
        if (t) this.sendOne(channel, args, t);
      }
      return;
    }

    this.sendOne(channel, args, target);
  }

  private sendOne(
    channel: IpcEvents,
    args: Array<any> | undefined,
    target: IpcSendTarget,
  ) {
    const _args = args || [];

    // Queue messages to WebContents until the ready signal
    if (isWebContents(target)) {
      if (!this.readyWebContents.has(target)) {
        const existing = this.messageQueue.get(target) || [];
        this.messageQueue.set(target, [...existing, [channel, args]]);
        return;
      }
      target.isDestroyed() || target.send(channel, ..._args);
      return;
    }

    target.send(channel, ..._args);
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
