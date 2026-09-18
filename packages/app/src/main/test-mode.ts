/**
 * Test mode: the flags, paths and endpoints every module reads, from one place.
 *
 * Test mode is on only in a test build (`vite build --mode test`, which defines
 * `__FIDDLE_TEST_BUILD__`) launched with `FIDDLE_TEST_MODE=1`. The e2e
 * launcher (packages/app/e2e/driver.ts) sets that and the other `FIDDLE_TEST_*`
 * variables. In release builds everything here is inert: `isTestMode()` is
 * false, `getEndpoints()` returns the real URLs and `getCacheRoot()` the real
 * cache. The harness itself (stubs, network guard, driver) lives in
 * ./test-driver and is compiled only into test builds. No Electron imports.
 */
import os from 'node:os';
import path from 'node:path';

import { DEFAULT_ENDPOINTS, fixtureEndpoints, type Endpoints } from '../shared/endpoints';

declare global {
  /** Vite define (vite.main.config.mts): true only in `--mode test` builds. */
  const __FIDDLE_TEST_BUILD__: boolean | undefined;
}

/** True in test builds. Unit tests (no define) see false. */
export const TEST_BUILD: boolean =
  typeof __FIDDLE_TEST_BUILD__ !== 'undefined' && __FIDDLE_TEST_BUILD__ === true;

/** True when a test build runs with FIDDLE_TEST_MODE=1. */
export function isTestMode(): boolean {
  return TEST_BUILD && process.env.FIDDLE_TEST_MODE === '1';
}

/**
 * What test mode turns off. Each feature checks its own flag, e.g.
 * `if (!testFlags().updates) return;` before starting update-electron-app.
 * Outside test mode every flag is true.
 */
export function testFlags(): {
  updates: boolean;
  sentry: boolean;
  firstRunPrompts: boolean;
  tour: boolean;
} {
  const on = !isTestMode();
  return { updates: on, sentry: on, firstRunPrompts: on, tour: on };
}

/**
 * `FIDDLE_TEST_MENUBAR=1`: draw the Windows and Linux title bar menu bar on
 * every platform, so e2e specs can drive it on a macOS desktop too.
 */
export function testMenuBar(): boolean {
  return isTestMode() && process.env.FIDDLE_TEST_MENUBAR === '1';
}

/** The per-run temp directory (userData, cache, logs, artifacts). Test mode only. */
function getTestDir(): string | undefined {
  return isTestMode() ? process.env.FIDDLE_TEST_DIR : undefined;
}

/**
 * The `core` cache root: `<OS cache dir>/Electron Fiddle/cache-v1`,
 * or `<test dir>/cache` in test mode. Call it after main's entry has run (the
 * test harness sets FIDDLE_TEST_DIR there), never at import time.
 */
export function getCacheRoot(): string {
  const testDir = getTestDir();
  if (testDir) return path.join(testDir, 'cache');
  return path.join(osCacheDir(), 'Electron Fiddle', 'cache-v1');
}

/**
 * The OS cache dir: `~/Library/Caches` on macOS, `%LOCALAPPDATA%` on
 * Windows, `$XDG_CACHE_HOME` or `~/.cache` on Linux. Not env-paths' `cache`,
 * which adds `<name>\Cache` on Windows.
 */
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

/**
 * Every base URL the app talks to. In test mode they point at the fixture
 * server (`FIDDLE_TEST_FIXTURE_URL`), or at a closed loopback port when there
 * is none, so a stray request fails fast instead of reaching the network.
 */
export function getEndpoints(): Endpoints {
  if (!isTestMode()) return DEFAULT_ENDPOINTS;
  return fixtureEndpoints(process.env.FIDDLE_TEST_FIXTURE_URL ?? 'http://127.0.0.1:9');
}

type MainTestHook = (...args: unknown[]) => unknown;
const mainTestHooks = new Map<string, MainTestHook>();

/**
 * Exposes main-side data or actions to e2e specs (`app.mainHook(name, ...args)`),
 * e.g. `registerMainTestHook('run.output', (windowId) => getOutput(windowId))`.
 * Does nothing outside test mode. Guard the call with `if (TEST_BUILD)` so the
 * hook's code is compiled out of release builds.
 */
export function registerMainTestHook(name: string, hook: MainTestHook): void {
  if (isTestMode()) mainTestHooks.set(name, hook);
}

export function getMainTestHook(name: string): MainTestHook | undefined {
  return mainTestHooks.get(name);
}
