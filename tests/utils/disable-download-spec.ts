import { disableDownload } from '../../src/utils/disable-download';
import {
  overrideArch,
  overridePlatform,
  resetArch,
  resetPlatform,
} from '../utils';

describe('disableDownload', () => {
  afterEach(() => {
    resetPlatform();
    resetArch();
  });

  it('always return false when the system is windows and the arch is not arm64', () => {
    overridePlatform('win32');
    overrideArch('x64');

    expect(disableDownload('6.0.0')).toBe(false);
    expect(disableDownload('6.0.8')).toBe(false);
    expect(disableDownload('7.0.0')).toBe(false);
    expect(disableDownload('8.0.0')).toBe(false);
  });

  it('returns true if the system is windows and the arch is arm64', () => {
    overridePlatform('win32');
    overrideArch('arm64');

    expect(disableDownload('6.0.0')).toBe(true);
    expect(disableDownload('6.0.8')).toBe(false);
    expect(disableDownload('7.0.0')).toBe(false);
    expect(disableDownload('8.0.0')).toBe(false);
  });

  it('always return false when the system is linux', () => {
    overridePlatform('linux');

    expect(disableDownload('10.0.0')).toBe(false);
    expect(disableDownload('11.0.0')).toBe(false);
    expect(disableDownload('12.0.0')).toBe(false);
  });

  it('always return false when the system is macOS and the arch is not arm64', () => {
    overridePlatform('darwin');
    overrideArch('x64');

    expect(disableDownload('10.0.0')).toBe(false);
    expect(disableDownload('11.0.0')).toBe(false);
    expect(disableDownload('12.0.0')).toBe(false);
  });

  it('returns true if the system is macOS and the arch is arm64', () => {
    overridePlatform('darwin');
    overrideArch('arm64');

    expect(disableDownload('10.0.0')).toBe(true);
    expect(disableDownload('11.0.0')).toBe(false);
    expect(disableDownload('12.0.0')).toBe(false);
  });
});
