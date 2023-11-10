import * as path from 'node:path';

import * as fs from 'fs-extra';
import { mocked } from 'jest-mock';

import {
  EditorId,
  EditorValues,
  MAIN_CJS,
  MAIN_JS,
  MAIN_MJS,
  PACKAGE_NAME,
} from '../../../src/interfaces';
import { readFiddle } from '../../../src/main/utils/read-fiddle';
import {
  ensureRequiredFiles,
  getEmptyContent,
  isSupportedFile,
} from '../../../src/utils/editor-utils';
import { createEditorValues } from '../../mocks/editor-values';

describe('read-fiddle', () => {
  const folder = '/some/place';

  beforeEach(() => {
    (fs.readFile as jest.Mock).mockImplementation(async (filename) => filename);
    console.warn = jest.fn();
  });

  afterEach(() => {
    mocked(console.warn).mockClear();
  });

  function setupFSMocks(editorValues: EditorValues) {
    (fs.readdir as jest.Mock).mockResolvedValue(Object.keys(editorValues));
    (fs.readFile as jest.Mock).mockImplementation(
      async (filename) => editorValues[path.basename(filename) as EditorId],
    );
  }

  it('injects main.js if not present', async () => {
    const mockValues = {}; // no files
    setupFSMocks(mockValues);

    const fiddle = await readFiddle(folder);

    expect(console.warn).not.toHaveBeenCalled();
    expect(fiddle).toStrictEqual({ [MAIN_JS]: getEmptyContent(MAIN_JS) });
  });

  it('does not inject main.js if main.cjs or main.mjs present', async () => {
    for (const entryPoint of [MAIN_CJS, MAIN_MJS]) {
      const mockValues = {
        [entryPoint]: getEmptyContent(entryPoint),
      };
      setupFSMocks(mockValues);

      const fiddle = await readFiddle(folder);

      expect(console.warn).not.toHaveBeenCalled();
      expect(fiddle).toStrictEqual({
        [entryPoint]: getEmptyContent(entryPoint),
      });
    }
  });

  it('reads supported files', async () => {
    const content = 'hello';
    const mockValues = { [MAIN_JS]: content };
    setupFSMocks(mockValues);

    const fiddle = await readFiddle(folder);
    expect(fiddle).toStrictEqual(mockValues);
  });

  it(`reads JSON files only if they are not ${PACKAGE_NAME}`, async () => {
    const content = 'hello im main';
    const mockValues = {
      [MAIN_JS]: content,
      'file.json': '{ "hello": "world" }',
      [PACKAGE_NAME]: '{}',
    };

    setupFSMocks(mockValues);

    const fiddle = await readFiddle(folder);
    expect(fiddle).toStrictEqual({
      [MAIN_JS]: content,
      'file.json': '{ "hello": "world" }',
    });
  });

  it('skips unsupported files', async () => {
    const content = 'hello';
    const mockValues = {
      [MAIN_JS]: content,
      'file.js': content,
      'file.php': content,
    };
    setupFSMocks(mockValues);
    const expected = Object.fromEntries(
      Object.entries(mockValues).filter(([id, _]) => isSupportedFile(id)),
    );

    const fiddle = await readFiddle(folder);

    expect(fiddle).toStrictEqual(expected);
  });

  function expectedOnReadError(values: EditorValues): EditorValues {
    // empty strings since the files could not be read,
    // and some truthy content in required files
    return ensureRequiredFiles(
      Object.fromEntries(Object.keys(values).map((id) => [id, ''])),
    );
  }

  it('handles read errors gracefully', async () => {
    const mockValues = createEditorValues();
    setupFSMocks(mockValues);
    (fs.readFile as jest.Mock).mockRejectedValue(new Error('bwap'));

    const files = await readFiddle(folder);
    expect(files).toStrictEqual(expectedOnReadError(mockValues));
  });

  it('ensures truthy even when read returns null', async () => {
    const mockValues = createEditorValues();
    setupFSMocks(mockValues);
    (fs.readFile as jest.Mock).mockResolvedValue(null);

    const files = await readFiddle(folder);
    expect(files).toStrictEqual(expectedOnReadError(mockValues));
  });
});
