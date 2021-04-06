import * as path from 'path';
import * as fs from 'fs-extra';

import { readFiddle } from '../../src/utils/read-fiddle';
import { DefaultEditorId } from '../../src/interfaces';

describe('read-fiddle', () => {
  beforeEach(async () => {
    (fs.existsSync as jest.Mock).mockImplementationOnce(() => true);
    (fs.readdirSync as jest.Mock).mockImplementationOnce(() => [
      'LICENSE.txt',
      DefaultEditorId.main,
    ]);
  });

  it('reads known content', async () => {
    (fs.readFileSync as jest.Mock).mockImplementation((filename) =>
      path.basename(filename),
    );
    console.warn = jest.fn();
    const folder = '/some/place';

    const fiddle = await readFiddle(folder);

    expect(fiddle[DefaultEditorId.css]).toBe('');
    expect(fiddle[DefaultEditorId.html]).toBe('');
    expect(fiddle[DefaultEditorId.main]).toBe(DefaultEditorId.main);
    expect(fiddle[DefaultEditorId.preload]).toBe('');
    expect(fiddle[DefaultEditorId.renderer]).toBe('');
    expect(console.warn).toHaveBeenCalledTimes(0);

    (console.warn as jest.Mock).mockClear();
  });

  it('handles read errors gracefully', async () => {
    (fs.readFileSync as jest.Mock).mockImplementation(() => {
      throw new Error('bwap');
    });
    console.warn = jest.fn();
    const folder = '/some/place';

    const fiddle = await readFiddle(folder);

    expect(fiddle[DefaultEditorId.css]).toBe('');
    expect(fiddle[DefaultEditorId.html]).toBe('');
    expect(fiddle[DefaultEditorId.main]).toBe('');
    expect(fiddle[DefaultEditorId.preload]).toBe('');
    expect(fiddle[DefaultEditorId.renderer]).toBe('');
    expect(console.warn).toHaveBeenCalledTimes(1);

    (console.warn as jest.Mock).mockClear();
  });

  it('ensures truty even when read returns null', async () => {
    (fs.readFileSync as jest.Mock).mockImplementation(() => null);
    console.warn = jest.fn();
    const folder = '/some/place';

    const fiddle = await readFiddle(folder);

    expect(fiddle[DefaultEditorId.css]).toBe('');
    expect(fiddle[DefaultEditorId.html]).toBe('');
    expect(fiddle[DefaultEditorId.main]).toBe('');
    expect(fiddle[DefaultEditorId.preload]).toBe('');
    expect(fiddle[DefaultEditorId.renderer]).toBe('');
    expect(console.warn).toHaveBeenCalledTimes(0);

    (console.warn as jest.Mock).mockClear();
  });
});
