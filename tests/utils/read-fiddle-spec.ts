import * as path from 'path';
import * as fs from 'fs-extra';

import { readFiddle } from '../../src/utils/read-fiddle';
import { isSupportedFile } from '../../src/utils/editor-utils';
import { DefaultEditorId } from '../../src/interfaces';

const defaultFiles = ['LICENSE.txt', DefaultEditorId.main];

describe('read-fiddle', () => {
  const folder = '/some/place';

  beforeEach(async () => {
    (fs.existsSync as jest.Mock).mockImplementationOnce(() => true);
  });

  function setupFSMocks(editorValues: Record<string, string>) {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockReturnValue(Object.keys(editorValues));
    (fs.readFileSync as jest.Mock).mockImplementation((filename) => {
      return editorValues[path.basename(filename)];
    });
  }

  it('reads known content', async () => {
    (fs.readdirSync as jest.Mock).mockImplementationOnce(() => defaultFiles);
    (fs.readFileSync as jest.Mock).mockImplementation((filename) =>
      path.basename(filename),
    );
    console.warn = jest.fn();
    const folder = '/some/place';

    const mosaics = await readFiddle(folder);

    expect(Object.keys(mosaics)).toHaveLength(5);
    expect(mosaics[DefaultEditorId.css]).toBe('');
    expect(mosaics[DefaultEditorId.html]).toBe('');
    expect(mosaics[DefaultEditorId.main]).toBe(DefaultEditorId.main);
    expect(mosaics[DefaultEditorId.preload]).toBe('');
    expect(mosaics[DefaultEditorId.renderer]).toBe('');
    expect(console.warn).toHaveBeenCalledTimes(0);

    (console.warn as jest.Mock).mockClear();
  });

  it('reads custom content', async () => {
    const file = 'file.js';
    (fs.readdirSync as jest.Mock).mockImplementationOnce(() => [file]);
    (fs.readFileSync as jest.Mock).mockImplementation(() => '');

    console.warn = jest.fn();
    const folder = '/some/place';

    const mosaics = await readFiddle(folder);

    expect(Object.keys(mosaics)).toHaveLength(6);
    expect(mosaics[file]).toBe('');
    expect(mosaics[DefaultEditorId.css]).toBe('');
    expect(mosaics[DefaultEditorId.html]).toBe('');
    expect(mosaics[DefaultEditorId.main]).toBe('');
    expect(mosaics[DefaultEditorId.preload]).toBe('');
    expect(mosaics[DefaultEditorId.renderer]).toBe('');
    expect(console.warn).toHaveBeenCalledTimes(0);

    (console.warn as jest.Mock).mockClear();
  });

  it('skips unsupported files', async () => {
    const content = 'hello';
    const mockValues = {
      [DefaultEditorId.css]: content,
      [DefaultEditorId.html]: content,
      [DefaultEditorId.main]: content,
      [DefaultEditorId.preload]: content,
      [DefaultEditorId.renderer]: content,
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
    (fs.readdirSync as jest.Mock).mockImplementationOnce(() => defaultFiles);
    (fs.readFileSync as jest.Mock).mockImplementation(() => {
      throw new Error('bwap');
    });
    console.warn = jest.fn();
    const folder = '/some/place';

    const mosaics = await readFiddle(folder);

    expect(Object.keys(mosaics)).toHaveLength(5);
    expect(mosaics[DefaultEditorId.css]).toBe('');
    expect(mosaics[DefaultEditorId.html]).toBe('');
    expect(mosaics[DefaultEditorId.main]).toBe('');
    expect(mosaics[DefaultEditorId.preload]).toBe('');
    expect(mosaics[DefaultEditorId.renderer]).toBe('');
    expect(console.warn).toHaveBeenCalledTimes(1);

    (console.warn as jest.Mock).mockClear();
  });

  it('ensures truthy even when read returns null', async () => {
    (fs.readdirSync as jest.Mock).mockImplementationOnce(() => defaultFiles);
    (fs.readFileSync as jest.Mock).mockImplementation(() => null);
    console.warn = jest.fn();
    const folder = '/some/place';

    const mosaics = await readFiddle(folder);

    expect(Object.keys(mosaics)).toHaveLength(5);
    expect(mosaics[DefaultEditorId.css]).toBe('');
    expect(mosaics[DefaultEditorId.html]).toBe('');
    expect(mosaics[DefaultEditorId.main]).toBe('');
    expect(mosaics[DefaultEditorId.preload]).toBe('');
    expect(mosaics[DefaultEditorId.renderer]).toBe('');
    expect(console.warn).toHaveBeenCalledTimes(0);

    (console.warn as jest.Mock).mockClear();
  });
});
