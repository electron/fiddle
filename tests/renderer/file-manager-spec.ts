import { shell } from 'electron';
import { IpcEvents } from '../../src/ipc-events';
import { FileManager } from '../../src/renderer/file-manager';
import { ipcRendererManager } from '../../src/renderer/ipc';
import { ElectronFiddleMock } from '../mocks/electron-fiddle';

jest.mock('fs-extra');
jest.mock('tmp', () => ({
  setGracefulCleanup: jest.fn(),
  dirSync: jest.fn(() => ({
    name: '/fake/temp'
  }))
}));
jest.mock('../../src/renderer/state');
jest.mock('electron', () => require('../mocks/electron'));
jest.mock('../../src/utils/import', () => ({
  fancyImport: async (p: string) => {
    if (p === 'fs-extra') {
      return require('fs-extra');
    }
    if (p === 'extract-zip') {
      return { default: require('extract-zip') };
    }
  }
}));

describe('FileManager', () => {
  let fm: FileManager;

  beforeEach(() => {
    window.ElectronFiddle = new ElectronFiddleMock() as any;
    ipcRendererManager.send = jest.fn();

    this.store = {};
    fm = new FileManager(this.store);
  });

  afterEach(() => {
    ipcRendererManager.removeAllListeners();
  });

  describe('openFiddle()', () => {
    it('opens a local fiddle', async () => {
      await fm.openFiddle('/fake/path');

      expect(window.ElectronFiddle.app.setValues).toHaveBeenCalledWith({});
    });

    it('handles an error', async () => {
      const fs = require('fs-extra');
      (fs.readFile as jest.Mock).mockImplementation(() => {
        throw new Error('bwap');
      });
      await fm.openFiddle('/fake/path');

      expect(window.ElectronFiddle.app.setValues).toHaveBeenCalledWith({
        html: '',
        renderer: '',
        main: ''
      });
    });

    it('runs it on IPC event', () => {
      fm.openFiddle = jest.fn();
      ipcRendererManager.emit(IpcEvents.FS_OPEN_FIDDLE);
      expect(fm.openFiddle).toHaveBeenCalled();
    });
  });

  describe('saveFiddle()', () => {
    it('saves as a local fiddle', async () => {
      const fs = require('fs-extra');

      await fm.saveFiddle('/fake/path');

      expect(fs.outputFile).toHaveBeenCalledTimes(4);
      expect(shell.showItemInFolder).toHaveBeenCalled();
    });

    it('handles an error', async () => {
      const fs = require('fs-extra');
      (fs.outputFile as jest.Mock).mockImplementation(() => {
        throw new Error('bwap');
      });

      await fm.saveFiddle('/fake/path');

      expect(fs.outputFile).toHaveBeenCalledTimes(4);
      expect(shell.showItemInFolder).toHaveBeenCalled();
      expect(ipcRendererManager.send).toHaveBeenCalledTimes(4);
    });

    it('runs saveFiddle (normal) on IPC event', () => {
      fm.saveFiddle = jest.fn();
      ipcRendererManager.emit(IpcEvents.FS_SAVE_FIDDLE);
      expect(fm.saveFiddle).toHaveBeenCalled();
    });

    it('runs saveFiddle (forge) on IPC event', () => {
      fm.saveFiddle = jest.fn();
      ipcRendererManager.emit(IpcEvents.FS_SAVE_FIDDLE_FORGE);
      expect(fm.saveFiddle).toHaveBeenCalled();
    });
  });

  describe('saveToTemp()', () => {
    it('saves as a local fiddle', async () => {
      const fs = require('fs-extra');
      const tmp = require('tmp');

      await fm.saveToTemp({ includeDependencies: false, includeElectron: false });

      expect(fs.outputFile).toHaveBeenCalledTimes(4);
      expect(tmp.setGracefulCleanup).toHaveBeenCalled();
    });

    it('handles an error', async () => {
      const fs = require('fs-extra');
      (fs.outputFile as jest.Mock).mockImplementation(() => {
        throw new Error('bwap');
      });

      await fm.saveFiddle('/fake/path');

      expect(fs.outputFile).toHaveBeenCalledTimes(4);
      expect(shell.showItemInFolder).toHaveBeenCalled();
      expect(ipcRendererManager.send).toHaveBeenCalledTimes(4);
    });
  });
});
