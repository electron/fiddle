/**
 * Test mode is on only in a test build (`__FIDDLE_TEST_BUILD__`, defined by
 * vite.main.config.mts) launched with `FIDDLE_TEST_MODE=1`. Every test-only read
 * here sits behind `TEST_BUILD`, so the bundler drops it from other builds.
 */
import os from 'node:os';
import path from 'node:path';

import { DEFAULT_ENDPOINTS, fixtureEndpoints, type Endpoints } from '../shared/endpoints';

declare global {
  const __FIDDLE_TEST_BUILD__: boolean | undefined;
}

/** True in test builds. Unit tests (no define) see false. */
export const TEST_BUILD: boolean =
  typeof __FIDDLE_TEST_BUILD__ !== 'undefined' && __FIDDLE_TEST_BUILD__ === true;

/** True when a test build runs with FIDDLE_TEST_MODE=1: no updates, Sentry, first-run prompts or tour. */
export function isTestMode(): boolean {
  return TEST_BUILD && process.env.FIDDLE_TEST_MODE === '1';
}

/** `FIDDLE_TEST_MENUBAR=1` draws the Windows and Linux menu bar on every platform, so e2e specs can drive it on macOS. */
export function testMenuBar(): boolean {
  return TEST_BUILD && isTestMode() && process.env.FIDDLE_TEST_MENUBAR === '1';
}

/** The per-run temp directory (userData, cache, logs, artifacts). Test mode only. */
function getTestDir(): string | undefined {
  return TEST_BUILD && isTestMode() ? process.env.FIDDLE_TEST_DIR : undefined;
}

/** The `core` cache root. Call it after main's entry has run (the harness sets FIDDLE_TEST_DIR there), never at import time. */
export function getCacheRoot(): string {
  const testDir = getTestDir();
  if (testDir) return path.join(testDir, 'cache');
  return path.join(osCacheDir(), 'Electron Fiddle', 'cache-v1');
}

/** The OS cache dir. Not env-paths' `cache`, which adds `<name>\Cache` on Windows. */
export function osCacheDir(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  home: string = os.homedir(),
): string {
  if (platform === 'darwin') return path.join(home, 'Library', 'Caches');
  if (platform === 'win32')
    return env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  return env.XDG_CACHE_HOME || path.join(home, '.cache');
}

/** Every base URL the app talks to. Without a fixture server, test mode uses a closed loopback port, so a stray request fails fast. */
export function getEndpoints(): Endpoints {
  return TEST_BUILD && isTestMode()
    ? fixtureEndpoints(process.env.FIDDLE_TEST_FIXTURE_URL ?? 'http://127.0.0.1:9')
    : DEFAULT_ENDPOINTS;
}
