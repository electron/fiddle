/**
 * @jest-environment node
 */

import * as electron from 'electron';

import { IpcEvents } from '../../src/ipc-events';
import { ipcMainManager } from '../../src/main/ipc';
import { getOrCreateMainWindow } from '../../src/main/windows';

jest.mock('../../src/main/windows');

describe('IpcMainManager', () => {
  afterEach(() => {
    ipcMainManager.removeAllListeners();
  });

  describe('emit()', () => {
    it('emits an Electron IPC event', () => {
      const mockListener = jest.fn();
      ipcMainManager.on(IpcEvents.SHOW_WARNING_DIALOG, mockListener);
      electron.ipcMain.emit(IpcEvents.SHOW_WARNING_DIALOG);

      expect(mockListener).toHaveBeenCalled();
    });
  });

  describe('send()', () => {
    it('sends an event and finds the main window', () => {
      const mockTarget = {
        webContents: {
          send: jest.fn(),
          isDestroyed: () => false,
        },
      };

      (getOrCreateMainWindow as jest.Mock<any>).mockReturnValue(mockTarget);
      ipcMainManager.readyWebContents.add(mockTarget.webContents as any);

      ipcMainManager.send(IpcEvents.FIDDLE_RUN);

      expect(mockTarget.webContents.send).toHaveBeenCalledWith<any>(
        IpcEvents.FIDDLE_RUN,
      );
    });

    it('sends an event to a target window', () => {
      const mockTarget = {
        send: jest.fn(),
        isDestroyed: () => false,
      };

      (getOrCreateMainWindow as jest.Mock<any>).mockReturnValue(null);
      ipcMainManager.readyWebContents.add(mockTarget as any);

      ipcMainManager.send(IpcEvents.FIDDLE_RUN, undefined, mockTarget as any);

      expect(mockTarget.send).toHaveBeenCalledWith<any>(IpcEvents.FIDDLE_RUN);
    });

    it('does not send an event to a target window if it is not ready', () => {
      const mockTarget = {
        send: jest.fn(),
      };

      (getOrCreateMainWindow as jest.Mock<any>).mockReturnValue(null);

      ipcMainManager.send(IpcEvents.FIDDLE_RUN, undefined, mockTarget as any);

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
