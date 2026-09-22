import { spawn, type ChildProcess } from 'node:child_process';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';

import { cleanFlags, fiddleProcessEnv, packageManagerEnv } from '../../fiddle/env';
import { PACKAGE_JSON, type FileMap } from '../../fiddle/files';
import { writeFiddleFolder } from '../../fiddle/folder';
import { loadLoginShellPath } from '../../fiddle/modules';
import { generatePackageJson, type PackageJsonInput } from '../../fiddle/package-json';
import { log } from '../log';
import { disclaimLauncher } from '../platform/disclaim';
import type { RunOutcome } from './logic';

const STALE_DIR_MS = 24 * 60 * 60 * 1000;
/** What `makeRunDir` makes: run dirs, and package and make projects (group 1). */
const TEMP_DIR_RE = /^electron-fiddle-((?:package|make)-)?[A-Za-z0-9]{6}$/;

let shellPath: Promise<string | undefined> | undefined;

/** FIDDLE_DEV_ELECTRON_FLAGS: extra flags for runs, e.g. `--no-sandbox` in a root container. Dev builds only. */
function devElectronFlags(): string[] {
  if (import.meta.env.MODE === 'production' || app.isPackaged) return [];
  return (process.env.FIDDLE_DEV_ELECTRON_FLAGS ?? '').split(' ').filter(Boolean);
}

/** The environment for npm, yarn and Forge, with the login shell's PATH. */
export async function toolEnv(): Promise<NodeJS.ProcessEnv> {
  shellPath ??= loadLoginShellPath();
  const resolved = await shellPath;
  const env = packageManagerEnv();
  if (resolved) env.PATH = resolved;
  return env;
}

/** A new run dir (`mkdtemp`, mode 0700). The caller deletes it with `removeDir`. */
export function makeRunDir(prefix = 'electron-fiddle-'): Promise<string> {
  return fsp.mkdtemp(path.join(os.tmpdir(), prefix));
}

/** Deletes a run dir or build project. A failure is only logged. */
export function removeDir(dir: string): Promise<void> {
  return fsp
    .rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    .catch((error: unknown) => log.warn('cleanup failed', dir, error));
}

/**
 * Deletes the dirs `makeRunDir` made in an earlier session that crashed or was killed, once they are a day old.
 * A package or make project with an `out` folder holds the user's build, so it stays.
 */
export async function sweepStaleDirs(root = os.tmpdir()): Promise<void> {
  for (const entry of await fsp.readdir(root, { withFileTypes: true })) {
    const match = entry.isDirectory() && TEMP_DIR_RE.exec(entry.name);
    if (!match) continue;
    const dir = path.join(root, entry.name);
    try {
      if (match[1] && (await fsp.stat(path.join(dir, 'out')).catch(() => undefined)))
        continue;
      if (Date.now() - (await fsp.stat(dir)).mtimeMs > STALE_DIR_MS)
        await fsp.rm(dir, { recursive: true, force: true, maxRetries: 3 });
    } catch (error) {
      // One locked or vanished dir must not stop the sweep.
      log.debug(`sweeping ${dir} failed`, error);
    }
  }
}

/** Writes the files and a generated `package.json` to `<dir>/app`, and returns that folder. */
export async function writeRunApp(
  dir: string,
  files: FileMap,
  packageJson: PackageJsonInput,
): Promise<string> {
  const appDir = path.join(dir, 'app');
  await writeFiddleFolder(
    appDir,
    { ...files, [PACKAGE_JSON]: generatePackageJson(packageJson) },
    [],
    { keepEmpty: true },
  );
  return appDir;
}

/** Replaces `<appDir>/package.json`, for example to add `devDependencies.electron` once modules are installed. */
export function writeRunPackageJson(
  appDir: string,
  packageJson: PackageJsonInput,
): Promise<void> {
  return fsp.writeFile(path.join(appDir, PACKAGE_JSON), generatePackageJson(packageJson));
}

interface SpawnElectronOptions {
  exec: string;
  appDir: string;
  /** The fiddle's userData goes in `<runDir>/user-data`, unless `keepUserDataDirs`. */
  runDir: string;
  flags: readonly string[];
  keepUserDataDirs: boolean;
  /** Parsed user variables. Blocked keys (see `isBlockedUserEnvKey`) are dropped. */
  env: Readonly<Record<string, string>>;
  advancedLogging: boolean;
  /**
   * Starts the Node inspector on 127.0.0.1 and a random port. The debugger URL,
   * with its random id, is published only on the child's stderr, not at
   * `/json/list`, so a process that cannot read the child's output cannot attach.
   */
  inspect: boolean;
}

/**
 * Spawns Electron on `appDir` with the filtered environment and stdout and
 * stderr as pipes. On macOS it starts through the privacy helper (which execs
 * Electron with the arguments and environment unchanged), and throws when a
 * packaged build lacks it.
 */
export function spawnElectron(options: SpawnElectronOptions): ChildProcess {
  const launcher = disclaimLauncher();
  const args = [
    ...(launcher ? [options.exec] : []),
    ...(options.inspect ? ['--inspect=127.0.0.1:0', '--inspect-publish-uid=stderr'] : []),
    ...(options.keepUserDataDirs
      ? []
      : [`--user-data-dir=${path.join(options.runDir, 'user-data')}`]),
    ...cleanFlags(options.flags),
    ...devElectronFlags(),
    options.appDir,
  ];
  return spawn(launcher ?? options.exec, args, {
    cwd: options.appDir,
    // Leads its own process group, so `killTree` reaches what the fiddle spawned.
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: fiddleProcessEnv({
      userEnv: options.env,
      advancedLogging: options.advancedLogging,
    }),
  });
}

/** Resolves when the child closes. A spawn error goes to `onError` and makes the outcome `spawnFailed`. */
export function waitForExit(
  child: ChildProcess,
  onError: (error: Error) => void = () => {},
): Promise<RunOutcome> {
  return new Promise<RunOutcome>((resolve) => {
    let failed = false;
    child.once('error', (error) => {
      failed = true;
      onError(error);
    });
    child.once('close', (code, signal) =>
      resolve(failed ? { spawnFailed: true } : { code, signal }),
    );
  });
}
