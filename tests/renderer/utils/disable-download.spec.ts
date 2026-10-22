import { afterEach, describe, expect, it } from 'vitest';

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

  it('returns true for Electron 44 and higher on 32-bit Windows', () => {
    overrideRendererPlatform('win32');
    overrideRendererArch('ia32');

    expect(disableDownload('43.0.0')).toBe(false);
    expect(disableDownload('44.0.0-alpha.3')).toBe(false);
    expect(disableDownload('44.0.0-alpha.4')).toBe(true);
    expect(disableDownload('44.0.0')).toBe(true);
    expect(disableDownload('44.5.1')).toBe(true);
    expect(disableDownload('46.0.0-nightly.20261021')).toBe(true);
  });

  it('returns true for Electron 44 and higher on 32-bit ARM Linux', () => {
    overrideRendererPlatform('linux');
    overrideRendererArch('arm');

    expect(disableDownload('43.0.0')).toBe(false);
    expect(disableDownload('44.0.0-alpha.3')).toBe(false);
    expect(disableDownload('44.0.0-alpha.4')).toBe(true);
    expect(disableDownload('44.5.1')).toBe(true);
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
