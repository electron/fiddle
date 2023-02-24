import * as fs from 'fs-extra';

import { Files, PACKAGE_NAME, SetFiddleOptions } from '../../src/interfaces';
import { IpcEvents } from '../../src/ipc-events';
import { App } from '../../src/renderer/app';
import { FileManager } from '../../src/renderer/file-manager';
import { ipcRendererManager } from '../../src/renderer/ipc';
import { isSupportedFile } from '../../src/utils/editor-utils';
import { readFiddle } from '../../src/utils/read-fiddle';
import { AppMock, createEditorValues } from '../mocks/mocks';

jest.mock('fs-extra');
jest.mock('tmp', () => ({
  setGracefulCleanup: jest.fn(),
  dirSync: jest.fn(() => ({
    name: '/fake/temp',
  })),
}));

jest.mock('../../src/utils/read-fiddle', () => ({
  readFiddle: jest.fn(),
}));

describe('FileManager', () => {
  const editorValues = createEditorValues();
  let app: AppMock;
  let fm: FileManager;

  beforeEach(() => {
    ipcRendererManager.send = jest.fn();
    (readFiddle as jest.Mock).mockReturnValue(Promise.resolve(editorValues));

    // create a real FileManager and insert it into our mocks
    app = (window.ElectronFiddle.app as unknown) as AppMock;
    fm = new FileManager(((app as unknown) as App).state);
    app.fileManager = fm as any;
  });

  afterEach(() => {
    ipcRendererManager.removeAllListeners();
  });

  describe('openFiddle()', () => {
    const filePath = '/fake/path';

    it('opens a local fiddle', async () => {
      const opts: SetFiddleOptions = { filePath };
      await fm.openFiddle(filePath);
      expect(app.replaceFiddle).toHaveBeenCalledWith(editorValues, opts);
    });

    it('opens a fiddle with supported files', async () => {
      const file = 'file.js';
      expect(isSupportedFile(file));
      const content = '// content';
      const values = { ...editorValues, [file]: content };
      (readFiddle as jest.Mock).mockResolvedValue(values);
      app.remoteLoader.confirmAddFile.mockResolvedValue(true);

      await fm.openFiddle(filePath);
      expect(readFiddle).toHaveBeenCalledWith(filePath, true);
      expect(app.replaceFiddle).toHaveBeenCalledWith(values, { filePath });
    });

    it('respects the Electron version specified in package.json', async () => {
      const pj = {
        main: 'main.js',
        devDependencies: {
          electron: '17.0.0',
        },
      };

      const values = {
        ...editorValues,
        [PACKAGE_NAME]: JSON.stringify(pj, null, 2),
      };
      (readFiddle as jest.Mock).mockResolvedValue(values);

      await fm.openFiddle(filePath);
      expect(app.remoteLoader.setElectronVersion).toBeCalledWith('17.0.0');
      expect(readFiddle).toHaveBeenCalledWith(filePath, true);
      expect(app.replaceFiddle).toHaveBeenCalledWith(editorValues, {
        filePath,
      });
    });

    it('correctly adds modules specified in package.json', async () => {
      const pj = {
        main: 'main.js',
        dependencies: {
          'meaning-of-life': '*',
        },
      };

      const values = {
        ...editorValues,
        [PACKAGE_NAME]: JSON.stringify(pj, null, 2),
      };
      (readFiddle as jest.Mock).mockResolvedValue(values);

      await fm.openFiddle(filePath);
      expect(readFiddle).toHaveBeenCalledWith(filePath, true);
      expect(app.state.modules.get('meaning-of-life')).toBe('*');
      expect(app.replaceFiddle).toHaveBeenCalledWith(editorValues, {
        filePath,
      });
    });

    it('runs it on IPC event', () => {
      fm.openFiddle = jest.fn();
      ipcRendererManager.emit(IpcEvents.FS_OPEN_FIDDLE);
      expect(fm.openFiddle).toHaveBeenCalled();
    });

    it('does not do anything with incorrect inputs', async () => {
      await fm.openFiddle({} as any);
      expect(app.replaceFiddle).not.toHaveBeenCalled();
    });

    it('does not do anything if cancelled', async () => {
      app.replaceFiddle.mockResolvedValueOnce(false);
      await fm.openFiddle('/fake/path');
    });
  });

  describe('saveFiddle()', () => {
    it('saves all non-empty files in Fiddle', async () => {
      const values = { ...editorValues };
      jest.spyOn(app, 'getEditorValues').mockReturnValue(values);

      await fm.saveFiddle('/fake/path');
      expect(fs.outputFile).toHaveBeenCalledTimes(Object.keys(values).length);
    });

    it('saves a fiddle with supported files', async () => {
      const file = 'file.js';
      const content = '// hi';
      const values = { ...editorValues, [file]: content };
      jest.spyOn(app, 'getEditorValues').mockReturnValue(values);

      await fm.saveFiddle('/fake/path');
      expect(fs.outputFile).toHaveBeenCalledTimes(Object.keys(values).length);
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

      const n = Object.keys(editorValues).length;
      // ipc calls for each editor value + one for SET_SHOW_ME_TEMPLATE
      const ipcCalls = n + 1;
      expect(fs.outputFile).toHaveBeenCalledTimes(n);
      expect(ipcRendererManager.send).toHaveBeenCalledTimes(ipcCalls);
    });

    it('handles an error (remove)', async () => {
      (fs.remove as jest.Mock).mockImplementation(() => {
        throw new Error('bwap');
      });
      await fm.saveFiddle('/fake/path');

      expect(fs.remove).toHaveBeenCalledTimes(1);
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
      const templateName = 'test';
      await fm.openTemplate(templateName);
      expect(app.replaceFiddle).toHaveBeenCalledWith(editorValues, {
        templateName,
      });
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
    let expected: Files;

    beforeEach(() => {
      app.getEditorValues.mockReturnValue(editorValues);
      expected = new Map(Object.entries(editorValues));
      expected.set(PACKAGE_NAME, undefined as any);
    });

    it(`always inserts ${PACKAGE_NAME}`, async () => {
      expect(await fm.getFiles()).toStrictEqual(expected);
    });

    it('includes supported files', async () => {
      const file = 'file.js';
      const content = '// file.js';
      expect(isSupportedFile(file));
      const values = { ...editorValues, [file]: content };

      app.getEditorValues.mockReturnValue(values);
      expect((await fm.getFiles()).get(file)).toStrictEqual(content);
    });

    it('applies transforms', async () => {
      const transformed: Files = new Map([['👉', '👈']]);
      const transform = async () => transformed;
      expect(await fm.getFiles(undefined, transform)).toBe(transformed);
    });

    it('handles transform error', async () => {
      const transform = async () => {
        throw new Error('💩');
      };
      const result = await fm.getFiles(undefined, transform);
      expect(result).toStrictEqual(expected);
    });
  });
});
