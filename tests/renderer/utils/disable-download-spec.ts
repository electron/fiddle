import { disableDownload } from '../../../src/renderer/utils/disable-download';
import {
  overrideRendererArch,
  overrideRendererPlatform,
  resetRendererArch,
  resetRendererPlatform,
} from '../../utils';

describe('disableDownload', () => {
  afterEach(() => {
    resetRendererPlatform();
    resetRendererArch();
  });

  it('always return false when the system is windows and the arch is not arm64', () => {
    overrideRendererPlatform('win32');
    overrideRendererArch('x64');

    expect(disableDownload('6.0.0')).toBe(false);
    expect(disableDownload('6.0.8')).toBe(false);
    expect(disableDownload('7.0.0')).toBe(false);
    expect(disableDownload('8.0.0')).toBe(false);
  });

  it('returns true if the system is windows and the arch is arm64', () => {
    overrideRendererPlatform('win32');
    overrideRendererArch('arm64');

    expect(disableDownload('6.0.0')).toBe(true);
    expect(disableDownload('6.0.8')).toBe(false);
    expect(disableDownload('7.0.0')).toBe(false);
    expect(disableDownload('8.0.0')).toBe(false);
  });

  it('always return false when the system is linux', () => {
    overrideRendererPlatform('linux');

    expect(disableDownload('10.0.0')).toBe(false);
    expect(disableDownload('11.0.0')).toBe(false);
    expect(disableDownload('12.0.0')).toBe(false);
  });

  it('always return false when the system is macOS and the arch is not arm64', () => {
    overrideRendererPlatform('darwin');
    overrideRendererArch('x64');

    expect(disableDownload('10.0.0')).toBe(false);
    expect(disableDownload('11.0.0')).toBe(false);
    expect(disableDownload('12.0.0')).toBe(false);
  });

  it('returns true if the system is macOS and the arch is arm64', () => {
    overrideRendererPlatform('darwin');
    overrideRendererArch('arm64');

    expect(disableDownload('10.0.0')).toBe(true);
    expect(disableDownload('11.0.0')).toBe(false);
    expect(disableDownload('12.0.0')).toBe(false);
  });
});
