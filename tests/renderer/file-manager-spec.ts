import { Files } from '../../src/interfaces';
import { IpcEvents } from '../../src/ipc-events';
import { FileManager } from '../../src/renderer/file-manager';
import { ipcRendererManager } from '../../src/renderer/ipc';
import { RENDERER_JS_NAME } from '../../src/shared-constants';
import { ElectronFiddleMock } from '../mocks/electron-fiddle';

jest.mock('fs-extra');
jest.mock('tmp', () => ({
  setGracefulCleanup: jest.fn(),
  dirSync: jest.fn(() => ({
    name: '/fake/temp'
  }))
}));
jest.mock('../../src/renderer/templates', () => ({
  getTemplateValues: () => ({
    html: '',
    main: '',
    renderer: ''
  })
}));

jest.mock('../../src/utils/import', () => ({
  fancyImport: async (p: string) => require(p)
}));

describe('FileManager', () => {
  let fm: FileManager;

  beforeEach(() => {
    window.ElectronFiddle = new ElectronFiddleMock() as any;
    ipcRendererManager.send = jest.fn();

    fm = new FileManager({
      setWarningDialogTexts: jest.fn()
    } as any);
  });

  afterEach(() => {
    ipcRendererManager.removeAllListeners();
  });

  describe('openFiddle()', () => {
    it('opens a local fiddle', async () => {
      const fakePath = '/fake/path';
      await fm.openFiddle(fakePath);

      expect(window.ElectronFiddle.app.replaceFiddle).toHaveBeenCalledWith({}, {filePath: fakePath});
    });

    it('writes empty strings if readFile throws an error', async () => {
      const fs = require('fs-extra');
      (fs.readFile as jest.Mock).mockImplementation(() => {
        throw new Error('bwap');
      });
      const fakePath = '/fake/path';
      await fm.openFiddle(fakePath);

      expect(window.ElectronFiddle.app.replaceFiddle).toHaveBeenCalledWith({
        html: '',
        renderer: '',
        preload: '',
        main: '',
      }, {filePath: fakePath});
    });

    it('runs it on IPC event', () => {
      fm.openFiddle = jest.fn();
      ipcRendererManager.emit(IpcEvents.FS_OPEN_FIDDLE);
      expect(fm.openFiddle).toHaveBeenCalled();
    });

    it('does not do anything with incorrect inputs', async () => {
      await fm.openFiddle({} as any);
      expect(window.ElectronFiddle.app.setEditorValues).toHaveBeenCalledTimes(0);
    });

    it('does not do anything if cancelled', async () => {
      (window.ElectronFiddle.app.setEditorValues as jest.Mock).mockResolvedValueOnce(false);
      await fm.openFiddle('/fake/path');
    });
  });

  describe('saveFiddle()', () => {
    it('saves as a local fiddle', async () => {
      const fs = require('fs-extra');

      await fm.saveFiddle('/fake/path');

      expect(fs.outputFile).toHaveBeenCalledTimes(3);
    });

    it('removes a file that is newly empty', async () => {
      const fs = require('fs-extra');

      await fm.saveFiddle('/fake/path');

      expect(fs.remove).toHaveBeenCalledTimes(2);
    });

    it('handles an error (output)', async () => {
      const fs = require('fs-extra');
      (fs.outputFile as jest.Mock).mockImplementation(() => {
        throw new Error('bwap');
      });

      await fm.saveFiddle('/fake/path');

      expect(fs.outputFile).toHaveBeenCalledTimes(3);
      expect(ipcRendererManager.send).toHaveBeenCalledTimes(3);
    });

    it('handles an error (remove)', async () => {
      const fs = require('fs-extra');
      (fs.remove as jest.Mock).mockImplementation(() => {
        throw new Error('bwap');
      });

      await fm.saveFiddle('/fake/path');

      expect(fs.remove).toHaveBeenCalledTimes(2);
      expect(ipcRendererManager.send).toHaveBeenCalledTimes(2);
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

    it('asks for a path via IPC if none can  be found', async () => {
      await fm.saveFiddle();

      expect(ipcRendererManager.send).toHaveBeenCalledWith(
        IpcEvents.FS_SAVE_FIDDLE_DIALOG
      );
    });
  });

  describe('saveToTemp()', () => {
    it('saves as a local fiddle', async () => {
      const fs = require('fs-extra');
      const tmp = require('tmp');

      await fm.saveToTemp({ includeDependencies: false, includeElectron: false });

      expect(fs.outputFile).toHaveBeenCalledTimes(5);
      expect(tmp.setGracefulCleanup).toHaveBeenCalled();
    });

    it('throws an error', async () => {
      const fs = require('fs-extra');
      (fs.outputFile as jest.Mock).mockImplementation(() => {
        throw new Error('bwap');
      });

      const testFn = async () => {
        await fm.saveToTemp({ includeDependencies: false, includeElectron: false });
      };
      let errored = false;

      try {
        await testFn();
      } catch (error) {
        errored = true;
      }

      expect(errored).toBe(true);
    });
  });

  describe('openTemplate()', () => {
    it('attempts to open a template', async () => {
      await fm.openTemplate('test');
      expect(window.ElectronFiddle.app.replaceFiddle).toHaveBeenCalledWith(
        {
          html: '',
          main: '',
          renderer: ''
        },
        {
          templateName: 'test'
        }
      );
    });

    it('runs openTemplate on IPC event', () => {
      fm.openTemplate = jest.fn();
      ipcRendererManager.emit(IpcEvents.FS_OPEN_TEMPLATE);
      expect(fm.openTemplate).toHaveBeenCalled();
    });
  });

  describe('cleanup()', () => {
    it('attempts to remove a directory if it exists', async () => {
      const fs = require('fs-extra');
      fs.existsSync.mockReturnValueOnce(true);

      const result = await fm.cleanup('/fake/dir');

      expect(fs.remove).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('does not attempt to remove a directory if it does not exists', async () => {
      const fs = require('fs-extra');
      fs.existsSync.mockReturnValueOnce(false);

      const result = await fm.cleanup('/fake/dir');

      expect(fs.remove).toHaveBeenCalledTimes(0);
      expect(result).toBe(false);
    });

    it('handles an error', async () => {
      const fs = require('fs-extra');
      fs.existsSync.mockReturnValueOnce(true);
      fs.remove.mockReturnValueOnce(Promise.reject('bwapbwap'));

      const result = await fm.cleanup('/fake/dir');

      expect(result).toBe(false);
    });
  });

  describe('getFiles()', () => {
    it('applies transforms', async () => {
      const result = await fm.getFiles(undefined, async (files: Files) => {
        files.set(RENDERER_JS_NAME, 'hi');
        return files;
      });

      expect(result.get(RENDERER_JS_NAME)).toBe('hi');
    });

    it('handles transform error', async () => {
      const result = await fm.getFiles(undefined, async () => {
        throw new Error('bwap bwap');
      });

      expect(result.get(RENDERER_JS_NAME)).toBe('renderer-content');
    });
  });
});
