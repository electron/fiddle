import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_ENDPOINTS } from '../shared/endpoints';
import { getCacheRoot, getEndpoints, isTestMode, osCacheDir } from './test-mode';

describe('osCacheDir', () => {
  const home = path.join(path.sep, 'home', 'ada');

  it('uses ~/Library/Caches on macOS', () => {
    expect(osCacheDir('darwin', {}, home)).toBe(path.join(home, 'Library', 'Caches'));
  });

  it('uses %LOCALAPPDATA% on Windows, with a fallback', () => {
    expect(osCacheDir('win32', { LOCALAPPDATA: 'C:\\Users\\ada\\AppData\\Local' }, home)).toBe(
      'C:\\Users\\ada\\AppData\\Local',
    );
    expect(osCacheDir('win32', {}, home)).toBe(path.join(home, 'AppData', 'Local'));
  });

  it('uses $XDG_CACHE_HOME or ~/.cache on Linux', () => {
    expect(osCacheDir('linux', { XDG_CACHE_HOME: '/var/cache/ada' }, home)).toBe('/var/cache/ada');
    expect(osCacheDir('linux', { XDG_CACHE_HOME: '' }, home)).toBe(path.join(home, '.cache'));
  });
});

describe('outside test builds', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('ignores FIDDLE_TEST_MODE and uses the real cache and endpoints', () => {
    vi.stubEnv('FIDDLE_TEST_MODE', '1');
    vi.stubEnv('FIDDLE_TEST_DIR', '/tmp/fiddle-test');
    expect(isTestMode()).toBe(false);
    expect(getCacheRoot()).toBe(path.join(osCacheDir(), 'Electron Fiddle', 'cache-v1'));
    expect(getEndpoints()).toEqual(DEFAULT_ENDPOINTS);
  });
});

describe('in a test build with FIDDLE_TEST_MODE=1', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('puts the cache in the test dir and endpoints on the fixture server', async () => {
    vi.stubGlobal('__FIDDLE_TEST_BUILD__', true);
    vi.stubEnv('FIDDLE_TEST_MODE', '1');
    vi.stubEnv('FIDDLE_TEST_DIR', '/tmp/fiddle-test');
    vi.stubEnv('FIDDLE_TEST_FIXTURE_URL', 'http://127.0.0.1:4000');
    vi.resetModules();
    const testMode = await import('./test-mode');
    expect(testMode.isTestMode()).toBe(true);
    expect(testMode.getCacheRoot()).toBe(path.join('/tmp/fiddle-test', 'cache'));
    expect(testMode.getEndpoints().releasesJson).toBe('http://127.0.0.1:4000/releases.json');
    expect(testMode.testFlags().updates).toBe(false);
  });
});
