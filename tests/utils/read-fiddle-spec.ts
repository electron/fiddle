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

    const { defaultMosaics, customMosaics } = await readFiddle(folder);

    expect(customMosaics).toMatchObject({});
    expect(defaultMosaics[DefaultEditorId.css]).toBe('');
    expect(defaultMosaics[DefaultEditorId.html]).toBe('');
    expect(defaultMosaics[DefaultEditorId.main]).toBe(DefaultEditorId.main);
    expect(defaultMosaics[DefaultEditorId.preload]).toBe('');
    expect(defaultMosaics[DefaultEditorId.renderer]).toBe('');
    expect(console.warn).toHaveBeenCalledTimes(0);

    (console.warn as jest.Mock).mockClear();
  });

  it('handles read errors gracefully', async () => {
    (fs.readFileSync as jest.Mock).mockImplementation(() => {
      throw new Error('bwap');
    });
    console.warn = jest.fn();
    const folder = '/some/place';

    const { defaultMosaics, customMosaics } = await readFiddle(folder);

    expect(customMosaics).toMatchObject({});
    expect(defaultMosaics[DefaultEditorId.css]).toBe('');
    expect(defaultMosaics[DefaultEditorId.html]).toBe('');
    expect(defaultMosaics[DefaultEditorId.main]).toBe('');
    expect(defaultMosaics[DefaultEditorId.preload]).toBe('');
    expect(defaultMosaics[DefaultEditorId.renderer]).toBe('');
    expect(console.warn).toHaveBeenCalledTimes(1);

    (console.warn as jest.Mock).mockClear();
  });

  it('ensures truthy even when read returns null', async () => {
    (fs.readFileSync as jest.Mock).mockImplementation(() => null);
    console.warn = jest.fn();
    const folder = '/some/place';

    const { defaultMosaics, customMosaics } = await readFiddle(folder);

    expect(customMosaics).toMatchObject({});
    expect(defaultMosaics[DefaultEditorId.css]).toBe('');
    expect(defaultMosaics[DefaultEditorId.html]).toBe('');
    expect(defaultMosaics[DefaultEditorId.main]).toBe('');
    expect(defaultMosaics[DefaultEditorId.preload]).toBe('');
    expect(defaultMosaics[DefaultEditorId.renderer]).toBe('');
    expect(console.warn).toHaveBeenCalledTimes(0);

    (console.warn as jest.Mock).mockClear();
  });
});
