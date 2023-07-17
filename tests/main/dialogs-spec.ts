/**
 * @jest-environment node
 */

import { dialog } from 'electron';
import * as fs from 'fs-extra';

import { IpcEvents } from '../../src/ipc-events';
import { setupDialogs } from '../../src/main/dialogs';
import { ipcMainManager } from '../../src/main/ipc';

jest.mock('fs-extra');
jest.mock('../../src/main/windows');

describe('dialogs', () => {
  beforeEach(() => {
    ipcMainManager.handle = jest.fn();
    setupDialogs();
  });

  it('sets up dialogs', () => {
    expect(ipcMainManager.eventNames()).toEqual([
      IpcEvents.SHOW_WARNING_DIALOG,
    ]);
    expect(ipcMainManager.handle).toHaveBeenCalledWith(
      IpcEvents.LOAD_LOCAL_VERSION_FOLDER,
      expect.anything(),
    );
  });

  describe('warning dialog', () => {
    it('shows dialog when triggering IPC event', () => {
      ipcMainManager.emit(IpcEvents.SHOW_WARNING_DIALOG, {}, { hi: 'hello' });
      expect(dialog.showMessageBox).toHaveBeenCalledWith(undefined, {
        type: 'warning',
        hi: 'hello',
      });
    });
  });

  describe('local version folder dialog', () => {
    let ipcHandler: () => Promise<any>;

    beforeAll(() => {
      // Manually invoke handler to simulate IPC event
      const call = (ipcMainManager.handle as jest.Mock).mock.calls.find(
        ([channelName]) => channelName === IpcEvents.LOAD_LOCAL_VERSION_FOLDER,
      );
      ipcHandler = call[1];
    });

    it('shows dialog when triggering IPC event', async () => {
      (dialog.showOpenDialog as jest.Mock).mockResolvedValue({
        filePaths: [],
      });

      await ipcHandler();
      expect(dialog.showOpenDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: ['openDirectory'],
        }),
      );
    });

    it('returns a SelectedLocalVersion for the path', () => {
      const paths = ['/test/path/'];

      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (dialog.showOpenDialog as jest.Mock).mockResolvedValue({
        filePaths: paths,
      });

      expect(ipcHandler()).resolves.toStrictEqual({
        folderPath: paths[0],
        isValidElectron: false,
        localName: undefined,
      });
    });

    it('returns nothing if not given a path', async () => {
      // empty array
      (dialog.showOpenDialog as jest.Mock).mockResolvedValue({
        filePaths: [],
      });
      expect(ipcHandler()).resolves.toBe(undefined);

      // nothing in response
      (dialog.showOpenDialog as jest.Mock).mockResolvedValue({});
      expect(ipcHandler()).resolves.toBe(undefined);
    });
  });
});
