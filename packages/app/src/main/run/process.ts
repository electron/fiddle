/**
 * The window-free pieces of a run (§17.6, §4 "Fiddle processes"), shared by
 * `RunService` and the headless CLI (main/cli): the run dir, the Electron
 * spawn, waiting for the exit, stopping, and the environment for npm, yarn
 * and Forge.
 */
import type { ChildProcess } from 'node:child_process';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { type ElectronVersions, Fiddle, type Installer, Runner } from '@electron/fiddle-core';

import { cleanFlags, fiddleProcessEnv } from '../../fiddle/env';
import { PACKAGE_JSON, type FileMap } from '../../fiddle/files';
import { writeFiddleFolder } from '../../fiddle/folder';
import { loadLoginShellPath } from '../../fiddle/modules';
import { generatePackageJson, type PackageJsonInput } from '../../fiddle/package-json';
import { devElectronFlags } from './dev';
import type { RunOutcome } from './logic';

const STOP_GRACE_MS = 1000;

let shellPath: Promise<string | undefined> | undefined;

/** The environment for npm, yarn and Forge: filtered like a fiddle's, with the login shell's PATH. */
export async function toolEnv(): Promise<NodeJS.ProcessEnv> {
  shellPath ??= loadLoginShellPath();
  const resolved = await shellPath;
  const env = fiddleProcessEnv();
  if (resolved) env.PATH = resolved;
  return env;
}

/** A new run dir (`mkdtemp`, mode 0700). The caller deletes it. */
export function makeRunDir(prefix = 'electron-fiddle-'): Promise<string> {
  return fsp.mkdtemp(path.join(os.tmpdir(), prefix));
}

/** Writes the files and a generated `package.json` to `<dir>/app`, and returns that folder. */
export async function writeRunApp(dir: string, files: FileMap, packageJson: PackageJsonInput): Promise<string> {
  const appDir = path.join(dir, 'app');
  await writeFiddleFolder(appDir, { ...files, [PACKAGE_JSON]: generatePackageJson(packageJson) });
  return appDir;
}

/** Replaces `<appDir>/package.json`, for example to add `devDependencies.electron` once modules are installed. */
export function writeRunPackageJson(appDir: string, packageJson: PackageJsonInput): Promise<void> {
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

/** Spawns Electron on `appDir` with the filtered environment. stdout and stderr are pipes. */
export async function spawnElectron(options: SpawnElectronOptions): Promise<ChildProcess> {
  const args = [...cleanFlags(options.flags), ...devElectronFlags()];
  if (!options.keepUserDataDirs) args.unshift(`--user-data-dir=${path.join(options.runDir, 'user-data')}`);
  const runner = await Runner.create({ installer: options.installer, versions: options.versions, errors: 'typed' });
  return runner.spawn(options.exec, new Fiddle(options.appDir, 'fiddle'), {
    args,
    showConfig: false,
    cwd: options.appDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: fiddleProcessEnv({ userEnv: options.env, advancedLogging: options.advancedLogging }),
    ...(options.inspect ? { inspect: { host: '127.0.0.1', port: 0 } } : {}),
    ...(options.quiet ? { out: undefined } : {}),
  });
}

/** Resolves when the child closes. A spawn error goes to `onError` and makes the outcome `spawnFailed`. */
export function waitForExit(child: ChildProcess, onError: (error: Error) => void = () => {}): Promise<RunOutcome> {
  return new Promise<RunOutcome>((resolve) => {
    let failed = false;
    child.once('error', (error) => {
      failed = true;
      onError(error);
    });
    child.once('close', (code, signal) => resolve(failed ? { spawnFailed: true } : { code, signal }));
  });
}

/** SIGTERM, then SIGKILL after a second (§17.6 "Stop"). */
export function stopChild(child: ChildProcess): void {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  const timer = setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }, STOP_GRACE_MS);
  child.once('exit', () => clearTimeout(timer));
}

/** The OS user name, the default package author. */
export function userName(): string {
  try {
    return os.userInfo().username;
  } catch {
    return '';
  }
}
