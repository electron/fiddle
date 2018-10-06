import { getElectronNameForPlatform } from '../../src/utils/electron-name';
import { overridePlatform, resetPlatform } from '../utils';

describe('electron-name', () => {
  afterAll(() => {
    resetPlatform();
  });

  it('returns the right name for each platform', () => {
    [
      { platform: 'win32', expected: 'electron.exe' },
      { platform: 'darwin', expected: 'Electron.app' },
      { platform: 'linux', expected: 'electron' }
    ].forEach(({ platform, expected }) => {
      overridePlatform(platform);
      expect(getElectronNameForPlatform()).toBe(expected);
    });
  });
});
