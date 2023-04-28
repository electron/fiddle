import { getElectronNameForPlatform } from '../../../src/renderer/utils/electron-name';
import { overrideRendererPlatform, resetRendererPlatform } from '../../utils';

describe('electron-name', () => {
  afterAll(() => {
    resetRendererPlatform();
  });

  it('returns the right name for each platform', () => {
    const platforms: Array<{ platform: NodeJS.Platform; expected: string }> = [
      { platform: 'win32', expected: 'electron.exe' },
      { platform: 'darwin', expected: 'Electron.app' },
      { platform: 'linux', expected: 'electron' },
    ];

    platforms.forEach(({ platform, expected }) => {
      overrideRendererPlatform(platform);
      expect(getElectronNameForPlatform()).toBe(expected);
    });
  });
});
