import { IpcEvents } from '../../src/ipc-events';
import { setupDialogs } from '../../src/main/dialogs';
import { ipcMainManager } from '../../src/main/ipc';

import { dialog } from 'electron';
import { flushPromises } from '../utils';

jest.mock('../../src/main/windows');

describe('dialogs', () => {

  beforeEach(() => {
    setupDialogs();
  });

  it('sets up dialogs', () => {
    expect(ipcMainManager.eventNames()).toEqual([
      IpcEvents.SHOW_WARNING_DIALOG,
      IpcEvents.SHOW_CONFIRMATION_DIALOG,
      IpcEvents.SHOW_LOCAL_VERSION_FOLDER_DIALOG
    ]);
  });

  describe('warning dialog', () => {
    it('shows dialog when triggering IPC event', () => {
      ipcMainManager.emit(IpcEvents.SHOW_WARNING_DIALOG, {}, { hi: 'hello' });
      expect(dialog.showMessageBox).toHaveBeenCalledWith(undefined, {
        type: 'warning',
        hi: 'hello'
      });
    });
  });

  describe('confirmation dialog', () => {
    it('shows dialog when triggering IPC event', () => {
      ipcMainManager.emit(IpcEvents.SHOW_CONFIRMATION_DIALOG, {}, { hi: 'hello' });
      expect(dialog.showMessageBox).toHaveBeenCalledWith(undefined, {
        type: 'warning',
        hi: 'hello'
      });
    });
  });

  describe('local version folder dialog', () => {
    it('shows dialog when triggering IPC event', () => {
      (dialog.showOpenDialog as jest.Mock).mockResolvedValue({
        filePaths: []
      });

      ipcMainManager.emit(IpcEvents.SHOW_LOCAL_VERSION_FOLDER_DIALOG, {
        reply: jest.fn()
      });
      expect(dialog.showOpenDialog).toHaveBeenCalledWith(expect.objectContaining({
        properties: ['openDirectory']
      }));
    });

    it('triggers IPC load local version event', async () => {
      const replyFn = jest.fn();
      const paths = ['/test/path/'];

      (dialog.showOpenDialog as jest.Mock).mockResolvedValue({
        filePaths: paths
      });

      ipcMainManager.emit(IpcEvents.SHOW_LOCAL_VERSION_FOLDER_DIALOG, {
        reply: replyFn
      });

      await flushPromises();
      expect(replyFn).toHaveBeenCalledWith(IpcEvents.LOAD_LOCAL_VERSION_FOLDER, paths);
    });

    it('does nothing if not given a path', async () => {
      const replyFn = jest.fn();

      // empty array
      (dialog.showOpenDialog as jest.Mock).mockResolvedValue({
        filePaths: []
      });
      ipcMainManager.emit(IpcEvents.SHOW_LOCAL_VERSION_FOLDER_DIALOG, {
        reply: replyFn
      });

      await flushPromises();
      expect(replyFn).not.toHaveBeenCalled();

      // nothing in response
      (dialog.showOpenDialog as jest.Mock).mockResolvedValue({});
      ipcMainManager.emit(IpcEvents.SHOW_LOCAL_VERSION_FOLDER_DIALOG, {
        reply: replyFn
      });

      await flushPromises();
      expect(replyFn).not.toHaveBeenCalled();
    });
  });
});
