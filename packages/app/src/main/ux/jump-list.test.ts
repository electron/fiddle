import { describe, expect, it } from 'vitest';

import { ARG_OPEN_FOLDER, jumpListFolder } from './jump-list';

describe('jumpListFolder', () => {
  const recent = ['/home/me/fiddle', 'C:\\Users\\me\\My fiddle'];

  it('takes a recent folder from a cold-start or second-instance argv', () => {
    expect(
      jumpListFolder(
        ['electron-fiddle.exe', ARG_OPEN_FOLDER, 'C:\\Users\\me\\My fiddle'],
        recent,
      ),
    ).toBe('C:\\Users\\me\\My fiddle');
    // Chromium adds its own switches to a second instance's argv.
    expect(
      jumpListFolder(
        [
          'electron',
          '--allow-file-access-from-files',
          ARG_OPEN_FOLDER,
          '/home/me/fiddle',
        ],
        recent,
      ),
    ).toBe('/home/me/fiddle');
  });

  it('opens only folders the jump list offers', () => {
    expect(jumpListFolder(['electron', ARG_OPEN_FOLDER, '/etc'], recent)).toBeUndefined();
    expect(jumpListFolder(['electron', ARG_OPEN_FOLDER], recent)).toBeUndefined();
    expect(jumpListFolder(['electron', '/home/me/fiddle'], recent)).toBeUndefined();
  });

  it('never acts on an argv that holds a deep link', () => {
    expect(
      jumpListFolder(
        ['electron', ARG_OPEN_FOLDER, '/home/me/fiddle', 'electron-fiddle://gist/abc'],
        recent,
      ),
    ).toBeUndefined();
  });
});
