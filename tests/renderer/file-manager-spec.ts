import * as fs from 'fs-extra';
import { mocked } from 'jest-mock';

import { Files, PACKAGE_NAME, SetFiddleOptions } from '../../src/interfaces';
import { App } from '../../src/renderer/app';
import { FileManager } from '../../src/renderer/file-manager';
import { isSupportedFile } from '../../src/utils/editor-utils';
import { AppMock, createEditorValues } from '../mocks/mocks';
import { emitEvent } from '../utils';

jest.mock('fs-extra');
jest.mock('tmp', () => ({
  setGracefulCleanup: jest.fn(),
  dirSync: jest.fn(() => ({
    name: '/fake/temp',
  })),
}));

describe('FileManager', () => {
  const editorValues = createEditorValues();
  let app: AppMock;
  let fm: FileManager;

  beforeEach(() => {
    mocked(window.ElectronFiddle.getTemplateValues).mockResolvedValue(
      editorValues,
    );

    // create a real FileManager and insert it into our mocks
    app = window.ElectronFiddle.app as unknown as AppMock;
    fm = new FileManager((app as unknown as App).state);
    (app as unknown as App).fileManager = fm;
  });

  it('replaces fiddle on an open-template event', () => {
    const templateName = 'test';
    emitEvent('open-template', templateName, editorValues);
    expect(app.replaceFiddle).toHaveBeenCalledWith(editorValues, {
      templateName,
    });
  });

  describe('openFiddle()', () => {
    const filePath = '/fake/path';

    it('opens a local fiddle', async () => {
      const opts: SetFiddleOptions = {
        localFiddle: { filePath, files: editorValues },
      };
      await fm.openFiddle(filePath, editorValues);
      expect(app.replaceFiddle).toHaveBeenCalledWith(editorValues, opts);
    });

    it('opens a fiddle with supported files', async () => {
      const file = 'file.js';
      expect(isSupportedFile(file));
      const content = '// content';
      const values = { ...editorValues, [file]: content };
      app.remoteLoader.confirmAddFile.mockResolvedValue(true);

      await fm.openFiddle(filePath, values);
      expect(app.replaceFiddle).toHaveBeenCalledWith(values, {
        localFiddle: { filePath, files: values },
      });
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

      await fm.openFiddle(filePath, values);
      expect(app.remoteLoader.setElectronVersion).toBeCalledWith('17.0.0');
      expect(app.replaceFiddle).toHaveBeenCalledWith(editorValues, {
        localFiddle: { filePath, files: values },
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

      await fm.openFiddle(filePath, values);
      expect(app.state.modules.get('meaning-of-life')).toBe('*');
      expect(app.replaceFiddle).toHaveBeenCalledWith(editorValues, {
        localFiddle: { filePath, files: values },
      });
    });

    it('runs it on an event', () => {
      fm.openFiddle = jest.fn();
      emitEvent('open-fiddle', filePath, editorValues);
      expect(fm.openFiddle).toHaveBeenCalled();
    });

    it('does not do anything with incorrect inputs', async () => {
      await fm.openFiddle({} as any, [] as any);
      expect(app.replaceFiddle).not.toHaveBeenCalled();
    });

    it('does not do anything if cancelled', async () => {
      app.replaceFiddle.mockResolvedValueOnce(false);
      await fm.openFiddle('/fake/path', editorValues);
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
      mocked(fs.outputFile).mockImplementation(() => {
        throw new Error('bwap');
      });

      await fm.saveFiddle('/fake/path');

      const n = Object.keys(editorValues).length;
      expect(fs.outputFile).toHaveBeenCalledTimes(n);
      expect(window.ElectronFiddle.setShowMeTemplate).toHaveBeenCalled();
    });

    it('handles an error (remove)', async () => {
      mocked(fs.remove).mockImplementation(() => {
        throw new Error('bwap');
      });
      await fm.saveFiddle('/fake/path');

      expect(fs.remove).toHaveBeenCalledTimes(1);
    });

    it('runs saveFiddle (normal) on event', () => {
      fm.saveFiddle = jest.fn();
      emitEvent('save-fiddle');
      expect(fm.saveFiddle).toHaveBeenCalled();
    });

    it('runs saveFiddle (forge) on event', () => {
      fm.saveFiddle = jest.fn();
      emitEvent('save-fiddle-forge');
      expect(fm.saveFiddle).toHaveBeenCalled();
    });

    it('asks for a path if none can  be found', async () => {
      await fm.saveFiddle();

      expect(window.ElectronFiddle.showSaveDialog).toHaveBeenCalled();
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

  describe('cleanup()', () => {
    it('attempts to remove a directory if it exists', async () => {
      mocked(fs.existsSync).mockReturnValueOnce(true);

      const result = await fm.cleanup('/fake/dir');

      expect(fs.remove).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('does not attempt to remove a directory if it does not exists', async () => {
      mocked(fs.existsSync).mockReturnValueOnce(false);

      const result = await fm.cleanup('/fake/dir');

      expect(fs.remove).toHaveBeenCalledTimes(0);
      expect(result).toBe(false);
    });

    it('handles an error', async () => {
      mocked(fs.existsSync).mockReturnValueOnce(true);
      (fs.remove as jest.Mock).mockRejectedValueOnce('bwapbwap');

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
