import { getElectronNameForPlatform } from '../../src/utils/electron-name';
import { overridePlatform, resetPlatform } from '../utils';

describe('electron-name', () => {
  afterAll(() => {
    resetPlatform();
  });

  it('returns the right name for each platform', () => {
    const platforms: Array<{ platform: NodeJS.Platform; expected: string }> = [
      { platform: 'win32', expected: 'electron.exe' },
      { platform: 'darwin', expected: 'Electron.app' },
      { platform: 'linux', expected: 'electron' },
    ];

    platforms.forEach(({ platform, expected }) => {
      overridePlatform(platform);
      expect(getElectronNameForPlatform()).toBe(expected);
    });
  });
});
