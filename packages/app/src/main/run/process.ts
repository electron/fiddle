import type { ChildProcess } from 'node:child_process';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  type ElectronVersions,
  Fiddle,
  type Installer,
  Runner,
} from '@electron/fiddle-core';

import { cleanFlags, fiddleProcessEnv, packageManagerEnv } from '../../fiddle/env';
import { PACKAGE_JSON, type FileMap } from '../../fiddle/files';
import { writeFiddleFolder } from '../../fiddle/folder';
import { killTree } from '../../fiddle/kill-tree';
import { loadLoginShellPath } from '../../fiddle/modules';
import { generatePackageJson, type PackageJsonInput } from '../../fiddle/package-json';
import { log } from '../log';
import { disclaimLauncher } from '../platform/disclaim';
import { devElectronFlags } from './dev';
import type { RunOutcome } from './logic';

const STALE_DIR_MS = 24 * 60 * 60 * 1000;
/** What `makeRunDir` makes: run dirs and package and make projects. */
const TEMP_DIR_RE = /^electron-fiddle-(?:(?:package|make)-)?[A-Za-z0-9]{6}$/;

let shellPath: Promise<string | undefined> | undefined;

/** The environment for npm, yarn and Forge, with the login shell's PATH. */
export async function toolEnv(): Promise<NodeJS.ProcessEnv> {
  shellPath ??= loadLoginShellPath();
  const resolved = await shellPath;
  const env = packageManagerEnv();
  if (resolved) env.PATH = resolved;
  return env;
}

/** A new run dir (`mkdtemp`, mode 0700). The caller deletes it. */
export function makeRunDir(prefix = 'electron-fiddle-'): Promise<string> {
  return fsp.mkdtemp(path.join(os.tmpdir(), prefix));
}

/** Deletes the dirs `makeRunDir` made in an earlier session that crashed or was killed, once they are a day old. */
export async function sweepStaleDirs(root = os.tmpdir()): Promise<void> {
  for (const entry of await fsp.readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !TEMP_DIR_RE.test(entry.name)) continue;
    const dir = path.join(root, entry.name);
    try {
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
  installer: Installer;
  versions: ElectronVersions;
  exec: string;
  appDir: string;
  /** The fiddle's userData goes in `<runDir>/user-data`, unless `keepUserDataDirs`. */
  runDir: string;
  flags: readonly string[];
  keepUserDataDirs: boolean;
  /** Parsed user variables; core drops `LD_*` and `DYLD_*`. */
  env: Readonly<Record<string, string>>;
  advancedLogging: boolean;
  /** The Node inspector on 127.0.0.1:0. */
  inspect: boolean;
  /** core's Runner echoes the child's output to `process.stdout` unless this is set. */
  quiet?: boolean;
}

/**
 * Spawns Electron on `appDir` with the filtered environment and stdout and
 * stderr as pipes. On macOS it starts through the privacy helper, and throws
 * when a packaged build lacks it.
 */
export async function spawnElectron(
  options: SpawnElectronOptions,
): Promise<ChildProcess> {
  const launcher = disclaimLauncher();
  const args = [...cleanFlags(options.flags), ...devElectronFlags()];
  if (!options.keepUserDataDirs)
    args.unshift(`--user-data-dir=${path.join(options.runDir, 'user-data')}`);
  const runner = await Runner.create({
    installer: options.installer,
    versions: options.versions,
    errors: 'typed',
  });
  return runner.spawn(options.exec, new Fiddle(options.appDir, 'fiddle'), {
    args,
    showConfig: false,
    cwd: options.appDir,
    // Leads its own process group, so `stopChild` reaches what the fiddle spawned.
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: fiddleProcessEnv({
      userEnv: options.env,
      advancedLogging: options.advancedLogging,
    }),
    ...(launcher ? { launcher } : {}),
    ...(options.inspect ? { inspect: { host: '127.0.0.1', port: 0 } } : {}),
    ...(options.quiet ? { out: undefined } : {}),
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

/** Stops the fiddle and what it spawned. */
export function stopChild(child: ChildProcess): void {
  killTree(child);
}
