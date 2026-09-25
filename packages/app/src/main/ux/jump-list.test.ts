import { describe, expect, it } from 'vitest';

import { ARG_OPEN_FOLDER, jumpListFolder, openFolderArg } from './jump-list';

describe('openFolderArg', () => {
  it('quotes the switch for the Windows command line, drive roots included', () => {
    expect(openFolderArg('C:\\Users\\me\\My fiddle')).toBe(
      `"${ARG_OPEN_FOLDER}=C:\\Users\\me\\My fiddle"`,
    );
    expect(openFolderArg('D:\\')).toBe(`"${ARG_OPEN_FOLDER}=D:\\\\"`);
  });
});

describe('jumpListFolder', () => {
  const recent = ['/home/me/fiddle', 'C:\\Users\\me\\My fiddle'];
  const open = (dir: string) => `${ARG_OPEN_FOLDER}=${dir}`;

  it('takes a recent folder from a cold-start or second-instance argv', () => {
    expect(
      jumpListFolder(['electron-fiddle.exe', open('C:\\Users\\me\\My fiddle')], recent),
    ).toBe('C:\\Users\\me\\My fiddle');
    // A second instance's argv has Chromium's switches first, this one among them, then the arguments.
    expect(
      jumpListFolder(
        ['electron', open('/home/me/fiddle'), '--enable-sandbox', '--lang=de', 'C:\\app'],
        recent,
      ),
    ).toBe('/home/me/fiddle');
  });

  it('opens only folders the jump list offers', () => {
    expect(jumpListFolder(['electron', open('/etc')], recent)).toBeUndefined();
    expect(
      jumpListFolder(['electron', ARG_OPEN_FOLDER, '/home/me/fiddle'], recent),
    ).toBeUndefined();
    expect(jumpListFolder(['electron', '/home/me/fiddle'], recent)).toBeUndefined();
  });

  it('never acts on an argv that holds a deep link', () => {
    expect(
      jumpListFolder(
        ['electron', open('/home/me/fiddle'), 'electron-fiddle://gist/abc'],
        recent,
      ),
    ).toBeUndefined();
  });
});
