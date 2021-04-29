import * as fs from 'fs-extra';
import * as path from 'path';

import { DefaultEditorId, Files } from '../../src/interfaces';
import { IpcEvents } from '../../src/ipc-events';
import { FileManager } from '../../src/renderer/file-manager';
import { ipcRendererManager } from '../../src/renderer/ipc';

import { AppMock } from '../mocks/mocks';

jest.mock('fs-extra');
jest.mock('tmp', () => ({
  setGracefulCleanup: jest.fn(),
  dirSync: jest.fn(() => ({
    name: '/fake/temp',
  })),
}));
jest.mock('../../src/renderer/templates', () => ({
  getTemplateValues: () => ({
    [DefaultEditorId.html]: '',
    [DefaultEditorId.main]: '',
    [DefaultEditorId.renderer]: '',
  }),
}));

describe('FileManager', () => {
  let app: AppMock;
  let fm: FileManager;

  beforeEach(() => {
    ({ app } = (window as any).ElectronFiddle);
    ipcRendererManager.send = jest.fn();

    fm = new FileManager({
      setGenericDialogOptions: jest.fn(),
    } as any);
    app.fileManager = fm as any;
  });

  afterEach(() => {
    ipcRendererManager.removeAllListeners();
  });

  describe('openFiddle()', () => {
    it('opens a local fiddle', async () => {
      const fakePath = '/fake/path';
      await fm.openFiddle(fakePath);

      expect(app.replaceFiddle).toHaveBeenCalledWith<any>(
        {
          [DefaultEditorId.html]: '',
          [DefaultEditorId.renderer]: '',
          [DefaultEditorId.preload]: '',
          [DefaultEditorId.main]: '',
          [DefaultEditorId.css]: '',
        },
        { filePath: fakePath },
      );
    });

    it('can open a fiddle with custom editors', async () => {
      const fakePath = '/fake/path';
      const file = 'file.js';

      app.remoteLoader.verifyCreateCustomEditor.mockResolvedValue(true);
      (fs.existsSync as jest.Mock).mockImplementationOnce(() => true);
      (fs.readdirSync as jest.Mock).mockImplementation(() => [
        file,
        DefaultEditorId.html,
      ]);
      (fs.readFileSync as jest.Mock).mockImplementation((filename) => {
        return path.basename(filename) === file ? 'hey' : '';
      });

      await fm.openFiddle(fakePath);

      expect(app.replaceFiddle).toHaveBeenCalledWith<any>(
        {
          [DefaultEditorId.html]: '',
          [DefaultEditorId.renderer]: '',
          [DefaultEditorId.preload]: '',
          [DefaultEditorId.main]: '',
          [DefaultEditorId.css]: '',
          [file]: 'hey',
        },
        { filePath: fakePath },
      );
    });

    it('writes empty strings if readFile throws an error', async () => {
      (fs.readFile as jest.Mock).mockImplementation(() => {
        throw new Error('bwap');
      });
      const fakePath = '/fake/path';
      await fm.openFiddle(fakePath);

      expect(app.replaceFiddle).toHaveBeenCalledWith<any>(
        {
          [DefaultEditorId.html]: '',
          [DefaultEditorId.renderer]: '',
          [DefaultEditorId.preload]: '',
          [DefaultEditorId.main]: '',
          [DefaultEditorId.css]: '',
        },
        { filePath: fakePath },
      );
    });

    it('runs it on IPC event', () => {
      fm.openFiddle = jest.fn();
      ipcRendererManager.emit(IpcEvents.FS_OPEN_FIDDLE);
      expect(fm.openFiddle).toHaveBeenCalled();
    });

    it('does not do anything with incorrect inputs', async () => {
      await fm.openFiddle({} as any);
      expect(app.setEditorValues).not.toHaveBeenCalled();
    });

    it('does not do anything if cancelled', async () => {
      (app.setEditorValues as jest.Mock).mockResolvedValueOnce(false);
      await fm.openFiddle('/fake/path');
    });
  });

  describe('saveFiddle()', () => {
    it('saves all non-empty files in Fiddle', async () => {
      await fm.saveFiddle('/fake/path');

      expect(fs.outputFile).toHaveBeenCalledTimes(5);
    });

    it('saves a fiddle with custom editors', async () => {
      const file = 'file.js';
      app.state.customMosaics = [file];
      (app.getEditorValues as jest.Mock<any>).mockReturnValueOnce({
        [file]: 'hi',
        [DefaultEditorId.html]: 'html',
        [DefaultEditorId.renderer]: 'renderer',
        [DefaultEditorId.preload]: 'preload',
        [DefaultEditorId.main]: 'main',
        [DefaultEditorId.css]: 'css',
      });

      await fm.saveFiddle('/fake/path');

      expect(fs.outputFile).toHaveBeenCalledTimes(6);
    });

    it('removes a file that is newly empty', async () => {
      await fm.saveFiddle('/fake/path');

      expect(fs.remove).toHaveBeenCalledTimes(1);
    });

    it('handles an error (output)', async () => {
      (fs.outputFile as jest.Mock).mockImplementation(() => {
        throw new Error('bwap');
      });

      await fm.saveFiddle('/fake/path');

      expect(fs.outputFile).toHaveBeenCalledTimes(5);
      expect(ipcRendererManager.send).toHaveBeenCalledTimes(5);
    });

    it('handles an error (remove)', async () => {
      (fs.remove as jest.Mock).mockImplementation(() => {
        throw new Error('bwap');
      });

      await fm.saveFiddle('/fake/path');

      expect(fs.remove).toHaveBeenCalledTimes(1);
      expect(ipcRendererManager.send).toHaveBeenCalledTimes(1);
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

      expect(ipcRendererManager.send).toHaveBeenCalledWith<any>(
        IpcEvents.FS_SAVE_FIDDLE_DIALOG,
      );
    });
  });

  describe('saveToTemp()', () => {
    it('saves as a local fiddle', async () => {
      const tmp = require('tmp');

      await fm.saveToTemp({
        includeDependencies: false,
        includeElectron: false,
      });

      expect(fs.outputFile).toHaveBeenCalledTimes(6);
      expect(tmp.setGracefulCleanup).toHaveBeenCalled();
    });

    it('throws an error', async () => {
      (fs.outputFile as jest.Mock).mockImplementation(() => {
        throw new Error('bwap');
      });

      const testFn = async () => {
        await fm.saveToTemp({
          includeDependencies: false,
          includeElectron: false,
        });
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
      expect(app.replaceFiddle).toHaveBeenCalledWith<any>(
        {
          [DefaultEditorId.html]: '',
          [DefaultEditorId.renderer]: '',
          [DefaultEditorId.main]: '',
        },
        {
          templateName: 'test',
        },
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
      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);

      const result = await fm.cleanup('/fake/dir');

      expect(fs.remove).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('does not attempt to remove a directory if it does not exists', async () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);

      const result = await fm.cleanup('/fake/dir');

      expect(fs.remove).toHaveBeenCalledTimes(0);
      expect(result).toBe(false);
    });

    it('handles an error', async () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
      (fs.remove as jest.Mock).mockReturnValueOnce(Promise.reject('bwapbwap'));

      const result = await fm.cleanup('/fake/dir');

      expect(result).toBe(false);
    });
  });

  describe('getFiles()', () => {
    it('applies transforms', async () => {
      const result = await fm.getFiles(undefined, async (files: Files) => {
        files.set(DefaultEditorId.renderer, 'hi');
        return files;
      });

      expect(result.get(DefaultEditorId.renderer)).toBe('hi');
    });

    it('handles custom editors', async () => {
      const file = 'file.js';
      app.state.customMosaics = [file];

      (app.getEditorValues as jest.Mock<any>).mockReturnValueOnce({
        [file]: 'file',
        [DefaultEditorId.html]: 'html',
        [DefaultEditorId.renderer]: 'renderer',
        [DefaultEditorId.preload]: 'preload',
        [DefaultEditorId.main]: 'main',
        [DefaultEditorId.css]: 'css',
      });

      const result = await fm.getFiles(undefined, async (files: Files) => {
        files.forEach((value, key) => {
          files.set(key, `${value}!`);
        });
        return files;
      });

      expect(result.get(DefaultEditorId.main)).toBe('main!');
      expect(result.get(DefaultEditorId.renderer)).toBe('renderer!');
      expect(result.get(DefaultEditorId.preload)).toBe('preload!');
      expect(result.get(DefaultEditorId.html)).toBe('html!');
      expect(result.get(DefaultEditorId.css)).toBe('css!');
      expect(result.get(file)).toBe('file!');
    });

    it('handles transform error', async () => {
      const result = await fm.getFiles(undefined, async () => {
        throw new Error('bwap bwap');
      });

      expect(result.get(DefaultEditorId.renderer)).toBe('renderer-content');
    });
  });
});
