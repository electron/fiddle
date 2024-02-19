import { mocked } from 'jest-mock';

import {
  Files,
  MAIN_JS,
  PACKAGE_NAME,
  SetFiddleOptions,
} from '../../src/interfaces';
import { App } from '../../src/renderer/app';
import { FileManager } from '../../src/renderer/file-manager';
import { dotfilesTransform } from '../../src/renderer/transforms/dotfiles';
import { isSupportedFile } from '../../src/utils/editor-utils';
import { AppMock, createEditorValues } from '../mocks/mocks';
import { emitEvent } from '../utils';

jest.mock('../../src/renderer/transforms/dotfiles');

describe('FileManager', () => {
  const editorValues = createEditorValues();
  let app: AppMock;
  let fm: FileManager;

  beforeEach(() => {
    mocked(window.ElectronFiddle.getTemplateValues).mockResolvedValue(
      editorValues,
    );

    // create a real FileManager and insert it into our mocks
    app = window.app as unknown as AppMock;
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

    it('handles bad JSON in package.json', async () => {
      const badPj =
        '{"main":"main.js","devDependencies":{"electron":"17.0.0",}}';
      const values = { ...editorValues, [PACKAGE_NAME]: badPj };

      await fm.openFiddle(filePath, values);
      expect(app.state.showErrorDialog).toHaveBeenCalledWith(
        expect.stringMatching(
          /Could not open Fiddle - invalid JSON found in package.json/i,
        ),
      );
    });

    it('respects the Electron version specified in package.json', async () => {
      const pj = {
        main: MAIN_JS,
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
        main: MAIN_JS,
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

  describe('saveToTemp()', () => {
    it('saves as a local fiddle', async () => {
      const tmpPath = '/tmp/save-to-temp/';
      mocked(window.ElectronFiddle.saveFilesToTemp).mockResolvedValue(tmpPath);
      await expect(
        fm.saveToTemp({
          includeDependencies: false,
          includeElectron: false,
        }),
      ).resolves.toEqual(tmpPath);
      expect(window.ElectronFiddle.saveFilesToTemp).toHaveBeenCalled();
    });

    it('throws an error', async () => {
      mocked(window.ElectronFiddle.saveFilesToTemp).mockRejectedValue(
        new Error('bwap'),
      );

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

  describe('getFiles()', () => {
    let expected: Files;

    beforeEach(() => {
      app.getEditorValues.mockReturnValue(editorValues);
      expected = new Map(Object.entries(editorValues));
      expected.set(PACKAGE_NAME, undefined as any);
    });

    it(`always inserts ${PACKAGE_NAME}`, async () => {
      const { files } = await fm.getFiles();
      expect(files).toStrictEqual(expected);
    });

    it('includes supported files', async () => {
      const file = 'file.js';
      const content = '// file.js';
      expect(isSupportedFile(file));
      const values = { ...editorValues, [file]: content };

      app.getEditorValues.mockReturnValue(values);
      const { files } = await fm.getFiles();
      expect(files.get(file)).toStrictEqual(content);
    });

    it('applies transforms', async () => {
      const transformed: Files = new Map([['👉', '👈']]);
      mocked(dotfilesTransform).mockResolvedValue(transformed);
      const { files } = await fm.getFiles(undefined, ['dotfiles']);
      expect(files).toBe(transformed);
    });

    it('handles transform error', async () => {
      mocked(dotfilesTransform).mockRejectedValue(new Error('💩'));
      const { files } = await fm.getFiles(undefined, ['dotfiles']);
      expect(files).toStrictEqual(expected);
    });
  });
});
