/**
 * @vitest-environment node
 */

import * as electron from 'electron';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IpcEvents } from '../../src/ipc-events';
import { ipcMainManager } from '../../src/main/ipc';
import { getOrCreateMainWindow } from '../../src/main/windows';

vi.mock('../../src/main/windows');

describe('IpcMainManager', () => {
  afterEach(() => {
    ipcMainManager.removeAllListeners();
  });

  describe('emit()', () => {
    it('emits an Electron IPC event', () => {
      const mockListener = vi.fn();
      ipcMainManager.on(IpcEvents.SHOW_WARNING_DIALOG, mockListener);
      electron.ipcMain.emit(IpcEvents.SHOW_WARNING_DIALOG);

      expect(mockListener).toHaveBeenCalled();
    });
  });

  describe('send()', () => {
    it('sends an event and finds the main window', async () => {
      const mockTarget = {
        webContents: {
          send: vi.fn(),
          isDestroyed: () => false,
        } as unknown as Electron.WebContents,
      } as electron.BrowserWindow;

      vi.mocked(getOrCreateMainWindow).mockResolvedValue(mockTarget);
      ipcMainManager.readyWebContents.add(mockTarget.webContents);

      ipcMainManager.send(IpcEvents.FIDDLE_RUN);
      await new Promise(process.nextTick);

      expect(mockTarget.webContents.send).toHaveBeenCalledWith(
        IpcEvents.FIDDLE_RUN,
      );
    });

    it('sends an event to a target window', () => {
      const mockTarget = {
        send: vi.fn(),
        isDestroyed: () => false,
      } as unknown as Electron.WebContents;

      vi.mocked(getOrCreateMainWindow).mockResolvedValue(null as any);
      ipcMainManager.readyWebContents.add(mockTarget);

      ipcMainManager.send(IpcEvents.FIDDLE_RUN, undefined, mockTarget);

      expect(mockTarget.send).toHaveBeenCalledWith(IpcEvents.FIDDLE_RUN);
    });

    it('does not send an event to a target window if it is not ready', () => {
      const mockTarget = {
        send: vi.fn(),
      } as unknown as Electron.WebContents;

      vi.mocked(getOrCreateMainWindow).mockResolvedValue(null as any);

      ipcMainManager.send(IpcEvents.FIDDLE_RUN, undefined, mockTarget);

      expect(mockTarget.send).toHaveBeenCalledTimes(0);
    });
  });

  describe('handle()', () => {
    it('calls ipcMain.handle', () => {
      const noop = () => ({});
      ipcMainManager.handle(IpcEvents.FIDDLE_RUN, noop);
      expect(electron.ipcMain.handle).toHaveBeenCalledWith(
        IpcEvents.FIDDLE_RUN,
        noop,
      );
    });
  });

  describe('handleOnce()', () => {
    it('calls ipcMain.handleOnce', () => {
      const noop = () => ({});
      ipcMainManager.handleOnce(IpcEvents.FIDDLE_RUN, noop);
      expect(electron.ipcMain.handleOnce).toHaveBeenCalledWith(
        IpcEvents.FIDDLE_RUN,
        noop,
      );
    });
  });
});
