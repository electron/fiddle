/**
 * @vitest-environment node
 */

import { dialog } from 'electron';
import fs from 'fs-extra';
import { vi } from 'vitest';

import { IpcEvents } from '../../src/ipc-events';
import { setupDialogs } from '../../src/main/dialogs';
import { ipcMainManager } from '../../src/main/ipc';

vi.mock('fs-extra');
vi.mock('../../src/main/windows');

describe('dialogs', () => {
  beforeEach(() => {
    ipcMainManager.handle = vi.fn();
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
      const call = vi
        .mocked(ipcMainManager.handle)
        .mock.calls.find(
          ([channelName]) =>
            channelName === IpcEvents.LOAD_LOCAL_VERSION_FOLDER,
        );
      if (call?.length && call.length > 1) {
        const rawIpcHandler = call[1];
        ipcHandler = async () =>
          rawIpcHandler({} as Electron.IpcMainInvokeEvent);
      } else {
        throw new Error('Could not find IPC listener');
      }
    });

    it('shows dialog when triggering IPC event', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        filePaths: [],
        canceled: true,
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

      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        filePaths: paths,
        canceled: false,
      });

      expect(ipcHandler()).resolves.toStrictEqual({
        folderPath: paths[0],
        isValidElectron: false,
        localName: undefined,
      });
    });

    it('returns nothing if not given a path', async () => {
      // empty array
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        filePaths: [],
        canceled: true,
      });
      expect(ipcHandler()).resolves.toBe(undefined);

      // nothing in response
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({} as any);
      expect(ipcHandler()).resolves.toBe(undefined);
    });
  });
});
