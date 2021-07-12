import * as fs from 'fs-extra';
import * as path from 'path';

import { EditorValues, MAIN_JS } from '../../src/interfaces';
import { createEditorValues } from '../mocks/editor-values';
import { isSupportedFile } from '../../src/utils/editor-utils';
import { readFiddle } from '../../src/utils/read-fiddle';

describe('read-fiddle', () => {
  const folder = '/some/place';

  beforeEach(() => {
    (fs.readFile as jest.Mock).mockImplementation((filename) =>
      Promise.resolve(filename),
    );
    console.warn = jest.fn();
  });

  afterEach(() => {
    (console.warn as jest.Mock).mockClear();
  });

  function setupFSMocks(editorValues: EditorValues) {
    (fs.readdir as jest.Mock).mockResolvedValue(Object.keys(editorValues));
    (fs.readFile as jest.Mock).mockImplementation((filename) =>
      Promise.resolve(editorValues[path.basename(filename)]),
    );
  }

  it('injects main.js if not present', async () => {
    const mockValues = {}; // no files
    setupFSMocks(mockValues);

    const fiddle = await readFiddle(folder);

    expect(console.warn).not.toHaveBeenCalled();
    expect(fiddle).toStrictEqual({ [MAIN_JS]: '' });
  });

  it('reads supported files', async () => {
    const content = 'hello';
    const mockValues = { [MAIN_JS]: content };
    setupFSMocks(mockValues);

    const fiddle = await readFiddle(folder);

    expect(fiddle).toStrictEqual(mockValues);
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

  it('handles read errors gracefully', async () => {
    const mockValues = createEditorValues();
    setupFSMocks(mockValues);
    (fs.readFile as jest.Mock).mockRejectedValue(new Error('bwap'));

    const files = await readFiddle(folder);

    const expectedFiles = Object.keys(mockValues);
    expect(Object.keys(files)).toStrictEqual(expectedFiles);
    Object.values(files).forEach((content) => expect(content).toBe(''));
    expect(console.warn).toHaveBeenCalledTimes(expectedFiles.length);
  });

  it('ensures truthy even when read returns null', async () => {
    const mockValues = createEditorValues();
    setupFSMocks(mockValues);
    (fs.readFile as jest.Mock).mockResolvedValue(null);

    const files = await readFiddle(folder);

    expect(Object.keys(files)).toStrictEqual(Object.keys(mockValues));
    Object.values(files).forEach((content) => expect(content).toBe(''));
    expect(console.warn).toHaveBeenCalledTimes(0);
  });
});
