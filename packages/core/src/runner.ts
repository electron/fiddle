import { type ChildProcess, type SpawnOptions, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Writable } from 'node:stream';
import { inspect } from 'node:util';

import debug from 'debug';

import { FiddleCoreError } from './errors.js';
import type { Fiddle } from './fiddle.js';
import { Installer } from './installer.js';
import type { ElectronVersions } from './versions.js';

export interface InspectOptions {
  /** Default: `127.0.0.1`. */
  host?: string;
  /** Default: `0`, a random free port. */
  port?: number;
}

export interface RunnerOptions {
  // extra arguments to be appended to the electron invocation
  args?: string[];
  // where the test's output should be written
  out?: Writable;
  // whether to show config info (e.g. platform os & arch) in the log
  showConfig?: boolean;
  /**
   * Start Electron with `--inspect=host:port`. The debugger URL, with its
   * random id, is published only on the child's stderr, not at `/json/list`,
   * so a process that cannot read the child's output cannot attach.
   */
  inspect?: InspectOptions;
  /**
   * An executable to spawn in place of Electron, which becomes its first
   * argument: `launcher <electron> <args…>`. It must run the program it is
   * given with the arguments and environment unchanged (the macOS privacy
   * helper does, by exec). Unset, Electron is spawned directly.
   */
  launcher?: string;
}

const DefaultRunnerOpts: RunnerOptions = {
  args: <string[]>[],
  out: process.stdout,
  showConfig: true,
} as const;

export type RunnerSpawnOptions = SpawnOptions & RunnerOptions;

export interface RunnerCreateOptions {
  installer: Installer;
  versions: ElectronVersions;
}

function inspectArgs({ host = '127.0.0.1', port = 0 }: InspectOptions): string[] {
  return [
    `--inspect=${host.includes(':') ? `[${host}]` : host}:${port}`,
    '--inspect-publish-uid=stderr',
  ];
}

export class Runner {
  private constructor(
    private readonly installer: Installer,
    private readonly versions: ElectronVersions,
  ) {}

  public static create(opts: RunnerCreateOptions): Promise<Runner> {
    return Promise.resolve(new Runner(opts.installer, opts.versions));
  }

  /**
   * Resolves `electron` to an executable path:
   * - an existing directory: the exec path inside it.
   * - an existing file: that file, as a local build.
   * - a version number: the installer's copy, installing it if needed.
   */
  private async getExec(electron: string): Promise<string> {
    try {
      // throws if `electron` isn't on disk
      const stat = fs.statSync(electron);
      if (!stat.isDirectory()) return electron;
      const name = Installer.getExecPath(electron);
      if (fs.existsSync(name)) return name;
    } catch {
      if (this.versions.isVersion(electron)) {
        return await this.installer.install(electron);
      }
    }
    throw new FiddleCoreError(
      'not-installed',
      `Unrecognized electron name: "${electron}"`,
    );
  }

  // FIXME(anyone): minor wart, 'source' is incorrect here if it's a local build
  private spawnInfo = (version: string, exec: string, fiddle: Fiddle) =>
    [
      '',
      '🧪 Testing',
      '',
      `  - date: ${new Date().toISOString()}`,
      '',
      '  - fiddle:',
      `      - source: ${fiddle.source}`,
      `      - local copy: ${path.dirname(fiddle.mainPath)}`,
      '',
      `  - electron_version: ${version}`,
      `      - source: https://github.com/electron/electron/releases/tag/v${version}`,
      `      - local copy: ${path.dirname(exec)}`,
      '',
      '  - test platform:',
      `      - os_arch: ${os.arch()}`,
      `      - os_platform: ${process.platform}`,
      `      - os_release: ${os.release()}`,
      `      - os_version: ${os.version()}`,
      '',
    ].join('\n');

  public async spawn(
    version: string,
    fiddle: Fiddle,
    opts: RunnerSpawnOptions = {},
  ): Promise<ChildProcess> {
    const d = debug('fiddle-core:Runner.spawn');

    opts = { ...DefaultRunnerOpts, ...opts };
    const electronExec = await this.getExec(version);
    let exec = electronExec;
    let args = [...(opts.args || []), fiddle.mainPath];
    if (opts.inspect) args.unshift(...inspectArgs(opts.inspect));
    if (opts.launcher) ({ exec, args } = { exec: opts.launcher, args: [exec, ...args] });

    if (opts.out && opts.showConfig) {
      opts.out.write(`${this.spawnInfo(version, electronExec, fiddle)}\n`);
    }

    d(inspect({ exec, args, opts }));

    const child = spawn(exec, args, opts);
    if (opts.out) {
      // `out` outlives the child, and stdout and stderr share it
      child.stdout?.pipe(opts.out, { end: false });
      child.stderr?.pipe(opts.out, { end: false });
    }

    return child;
  }
}
