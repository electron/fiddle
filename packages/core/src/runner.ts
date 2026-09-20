import { type ChildProcess, type SpawnOptions, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Writable } from 'node:stream';
import { inspect } from 'node:util';

import debug from 'debug';
import { SemVer } from 'semver';

import { type ChildEnvOptions, buildChildEnv } from './env.js';
import {
  type ErrorMode,
  FiddleCoreError,
  abortError,
  isFiddleCoreError,
  throwIfAborted,
} from './errors.js';
import { Installer } from './installer.js';
import { ElectronVersions, type Versions } from './versions.js';
import { type Fiddle, FiddleFactory, type FiddleSource } from './fiddle.js';
import { DefaultPaths, type Paths } from './paths.js';
import { registerElectronIdentity } from './windows-identity.js';

const MSIX_EXEC_ALIAS = 'ElectronFiddleMSIX.exe';

/** How long an aborted child gets to exit after SIGTERM before SIGKILL. */
const KILL_GRACE_MS = 5_000;

export interface InspectOptions {
  /** Default: `127.0.0.1`. */
  host?: string;
  /** Default: `0`, a random free port. */
  port?: number;
}

export interface RunnerOptions {
  // extra arguments to be appended to the electron invocation
  args?: string[];
  // if true, use xvfb-run on *nix
  headless?: boolean;
  // where the test's output should be written
  out?: Writable;
  // whether to show config info (e.g. platform os & arch) in the log
  showConfig?: boolean;
  // whether to run the fiddle from asar
  runFromAsar?: boolean;
  // whether to run Electron with Windows MSIX identity (Windows only).
  runWithIdentity?: boolean;
  /**
   * Build the child's environment from `env` (or `process.env`) minus a
   * denylist, plus user variables. See {@link buildChildEnv}. When unset, the
   * environment is passed through unchanged.
   */
  childEnv?: ChildEnvOptions;
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
  headless: false,
  out: process.stdout,
  showConfig: true,
} as const;

/**
 * Options for {@link Runner.spawn}, {@link Runner.run} and {@link Runner.bisect}.
 * `signal` cancels the install and kills the child with its whole process
 * tree. See {@link ErrorMode} for how `run` and `bisect` then settle.
 */
export type RunnerSpawnOptions = SpawnOptions & RunnerOptions;

export interface RunnerCreateOptions {
  installer?: Installer;
  fiddleFactory?: FiddleFactory;
  paths?: Partial<Paths>;
  versions?: Versions;
  /**
   * See {@link ErrorMode}. Also passed to the `Installer` and
   * `ElectronVersions` that `create()` makes. Default: `legacy`.
   */
  errors?: ErrorMode;
}

export interface TestResult {
  status: 'test_passed' | 'test_failed' | 'test_error' | 'system_error';
}

export interface BisectResult {
  range?: [string, string];
  status: 'bisect_succeeded' | 'test_error' | 'system_error';
}

function inspectArgs({ host = '127.0.0.1', port = 0 }: InspectOptions): string[] {
  return [
    `--inspect=${host.includes(':') ? `[${host}]` : host}:${port}`,
    '--inspect-publish-uid=stderr',
  ];
}

/**
 * Kills a child and everything it started, such as Electron under xvfb-run.
 * On POSIX the child leads its own process group (it was spawned detached),
 * which gets SIGTERM, then SIGKILL after a grace period.
 */
function killTree(child: ChildProcess): void {
  const { pid } = child;
  if (pid === undefined) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    }).on('error', () => {});
    return;
  }
  const killGroup = (signal: NodeJS.Signals) => {
    try {
      process.kill(-pid, signal);
    } catch {
      // the group is gone
    }
  };
  killGroup('SIGTERM');
  setTimeout(() => killGroup('SIGKILL'), KILL_GRACE_MS).unref();
}

export class Runner {
  readonly #errors: ErrorMode;

  private constructor(
    private readonly installer: Installer,
    private readonly versions: Versions,
    private readonly fiddleFactory: FiddleFactory,
    errors: ErrorMode = 'legacy',
  ) {
    this.#errors = errors;
  }

  public static async create(opts: RunnerCreateOptions = {}): Promise<Runner> {
    const { errors } = opts;
    const paths = Object.freeze({ ...DefaultPaths, ...opts.paths });
    const installer = opts.installer || new Installer(paths, { errors });
    const versions = opts.versions || (await ElectronVersions.create({ paths, errors }));
    const factory = opts.fiddleFactory || new FiddleFactory(paths.fiddles);
    return new Runner(installer, versions, factory, errors);
  }

  /**
   * Resolves `electron` to an executable path:
   * - an existing directory: the exec path inside it.
   * - an existing file: that file, as a local build.
   * - a version number: the installer's copy, installing it if needed.
   */
  private async getExec(electron: string, signal?: AbortSignal): Promise<string> {
    try {
      // throws if `electron` isn't on disk
      const stat = fs.statSync(electron);
      if (!stat.isDirectory()) return electron;
      const name = Installer.getExecPath(electron);
      if (fs.existsSync(name)) return name;
    } catch {
      if (this.versions.isVersion(electron)) {
        return await (signal
          ? this.installer.install(electron, { signal })
          : this.installer.install(electron));
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

  /** If headless specified on  *nix, try to run with xvfb-run */
  private static headless(
    exec: string,
    args: string[],
  ): { exec: string; args: string[] } {
    if (process.platform !== 'darwin' && process.platform !== 'win32') {
      // try to get a free server number
      args.unshift('--auto-servernum', exec);
      exec = 'xvfb-run';
    }
    return { exec, args };
  }

  public async spawn(
    versionIn: string | SemVer,
    fiddleIn: FiddleSource,
    opts: RunnerSpawnOptions = {},
  ): Promise<ChildProcess> {
    const d = debug('fiddle-core:Runner.spawn');

    opts = { ...DefaultRunnerOpts, ...opts };
    const { signal } = opts;
    throwIfAborted(signal);
    const version = versionIn instanceof SemVer ? versionIn.version : versionIn;
    const fiddle = await this.fiddleFactory.create(fiddleIn, {
      packAsAsar: opts.runFromAsar,
    });
    if (!fiddle)
      throw new FiddleCoreError(
        'invalid-fiddle',
        `Invalid fiddle: "${inspect(fiddleIn)}"`,
      );

    const electronExec = await this.getExec(version, signal);
    throwIfAborted(signal);
    let exec =
      process.platform === 'win32' && opts.runWithIdentity
        ? MSIX_EXEC_ALIAS
        : electronExec;
    let args = [...(opts.args || []), fiddle.mainPath];
    if (opts.inspect) args.unshift(...inspectArgs(opts.inspect));
    if (opts.headless) ({ exec, args } = Runner.headless(exec, args));
    if (opts.launcher) ({ exec, args } = { exec: opts.launcher, args: [exec, ...args] });

    if (opts.out && opts.showConfig) {
      opts.out.write(`${this.spawnInfo(version, electronExec, fiddle)}\n`);
    }

    // The signal is handled below rather than by child_process, so that an
    // abort kills the child's whole process tree.
    const { signal: _signal, ...spawnOpts } = opts;
    if (opts.childEnv) {
      spawnOpts.env = buildChildEnv(opts.childEnv, opts.env ?? process.env);
    }
    if (signal && process.platform !== 'win32') spawnOpts.detached = true;

    d(inspect({ exec, args, opts }));

    const child = spawn(exec, args, spawnOpts);
    if (opts.out) {
      // `out` outlives the child, and stdout and stderr share it
      child.stdout?.pipe(opts.out, { end: false });
      child.stderr?.pipe(opts.out, { end: false });
    }
    if (signal) {
      const onAbort = () => killTree(child);
      signal.addEventListener('abort', onAbort, { once: true });
      child.once('exit', () => signal.removeEventListener('abort', onAbort));
    }

    return child;
  }

  private static displayEmoji(result: TestResult): string {
    switch (result.status) {
      case 'system_error':
        return '🟠';
      case 'test_error':
        return '🔵';
      case 'test_failed':
        return '🔴';
      case 'test_passed':
        return '🟢';
    }
  }

  public static displayResult(result: TestResult): string {
    const text = Runner.displayEmoji(result);
    switch (result.status) {
      case 'system_error':
        return text + ' system error: test did not pass or fail';
      case 'test_error':
        return text + ' test error: test did not pass or fail';
      case 'test_failed':
        return text + ' failed';
      case 'test_passed':
        return text + ' passed';
    }
  }

  /** In `legacy` mode, an abort ends a run or bisect with `system_error`. */
  private settleAbort<T>(err: unknown, result: T): T {
    if (this.#errors !== 'typed' && isFiddleCoreError(err, 'aborted')) return result;
    throw err;
  }

  public async run(
    version: string | SemVer,
    fiddle: FiddleSource,
    opts: RunnerSpawnOptions = DefaultRunnerOpts,
  ): Promise<TestResult> {
    const { signal } = opts;
    try {
      if (process.platform === 'win32' && opts.runWithIdentity) {
        const electronVersion = version instanceof SemVer ? version.version : version;
        const electronExec = await this.getExec(electronVersion, signal);
        const electronDir = path.dirname(electronExec);
        await registerElectronIdentity(electronVersion, electronDir);
      }

      const subprocess = await this.spawn(version, fiddle, opts);

      return await new Promise<TestResult>((resolve, reject) => {
        subprocess.on('error', () => {
          if (signal?.aborted) return reject(abortError(signal));
          return resolve({ status: 'system_error' });
        });

        subprocess.on('exit', (code) => {
          if (signal?.aborted) return reject(abortError(signal));
          if (code === 0) return resolve({ status: 'test_passed' });
          if (code === 1) return resolve({ status: 'test_failed' });
          return resolve({ status: 'test_error' });
        });
      });
    } catch (err) {
      return this.settleAbort(err, { status: 'system_error' });
    }
  }

  public async bisect(
    version_a: string | SemVer,
    version_b: string | SemVer,
    fiddleIn: FiddleSource,
    opts: RunnerSpawnOptions = DefaultRunnerOpts,
  ): Promise<BisectResult> {
    try {
      return await this.bisectImpl(version_a, version_b, fiddleIn, opts);
    } catch (err) {
      return this.settleAbort(err, { status: 'system_error' });
    }
  }

  private async bisectImpl(
    version_a: string | SemVer,
    version_b: string | SemVer,
    fiddleIn: FiddleSource,
    opts: RunnerSpawnOptions,
  ): Promise<BisectResult> {
    const { out, signal } = opts;
    const log = (first: unknown, ...rest: unknown[]) => {
      if (out) {
        out.write([first, ...rest].join(' '));
        out.write('\n');
      }
    };

    throwIfAborted(signal);
    const versions = this.versions.inRange(version_a, version_b);
    if (versions.length < 2) {
      throw new FiddleCoreError(
        'invalid-version',
        `A bisect needs two different versions, got "${version_a.toString()}" and "${version_b.toString()}"`,
      );
    }
    const fiddle = await this.fiddleFactory.create(fiddleIn);
    if (!fiddle)
      throw new FiddleCoreError(
        'invalid-fiddle',
        `Invalid fiddle: "${inspect(fiddleIn)}"`,
      );

    const displayIndex = (i: number) => '#' + i.toString().padStart(4, ' ');

    log(
      [
        '📐 Bisect Requested',
        '',
        ` - gist is ${fiddle.source}`,
        ` - the version range is [${version_a.toString()}..${version_b.toString()}]`,
        ` - there are ${versions.length} versions in this range:`,
        '',
        ...versions.map((ver, i) => `${displayIndex(i)} - ${ver.version}`),
      ].join('\n'),
    );

    const LEFT_POS = 0;
    const RIGHT_POS = versions.length - 1;
    let left = LEFT_POS;
    let right = RIGHT_POS;
    let result: TestResult | undefined = undefined;
    const testOrder: (number | undefined)[] = [];
    const results = Array.from<TestResult | undefined>({ length: versions.length });
    while (left + 1 < right) {
      throwIfAborted(signal);
      const mid = Math.round(left + (right - left) / 2);
      const ver = versions[mid]!;
      testOrder.push(mid);
      log(`bisecting, range [${left}..${right}], mid ${mid} (${ver.version})`);

      result = await this.run(ver.version, fiddle, opts);
      results[mid] = result;
      log(`${Runner.displayResult(result)} ${ver.version}\n`);
      if (result.status === 'test_passed') {
        left = mid;
        continue;
      } else if (result.status === 'test_failed') {
        right = mid;
        continue;
      } else {
        break;
      }
    }

    // If a pointer ended on a boundary version that was never run, run it to
    // validate that boundary.
    const boundaries: Array<number> = [];
    if (left === LEFT_POS && !results[LEFT_POS]) boundaries.push(LEFT_POS);
    if (right === RIGHT_POS && !results[RIGHT_POS]) boundaries.push(RIGHT_POS);

    for (const position of boundaries) {
      throwIfAborted(signal);
      const ver = versions[position]!;
      const result = await this.run(ver.version, fiddle, opts);
      results[position] = result;
      log(`${Runner.displayResult(result)} ${ver.version}\n`);
    }

    log(`🏁 finished bisecting across ${versions.length} versions...`);
    versions.forEach((ver, i) => {
      const n = testOrder.indexOf(i);
      if (n === -1) return;
      log(displayIndex(i), Runner.displayResult(results[i]!), ver, `(test #${n + 1})`);
    });

    log('\n🏁 Done bisecting');
    const leftResult = results[left];
    const rightResult = results[right];
    const success =
      leftResult?.status === 'test_passed' && rightResult?.status === 'test_failed';
    if (success) {
      const good = versions[left]!.version;
      const bad = versions[right]!.version;
      log(
        [
          `${Runner.displayResult(leftResult)} ${good}`,
          `${Runner.displayResult(rightResult)} ${bad}`,
          'Commits between versions:',
          `https://github.com/electron/electron/compare/v${good}...v${bad} ↔`,
        ].join('\n'),
      );

      return {
        range: [good, bad],
        status: 'bisect_succeeded',
      };
    } else {
      // FIXME: log some failure
      if (result?.status === 'test_error' || result?.status === 'system_error') {
        return { status: result.status };
      }

      if (leftResult?.status === rightResult?.status) {
        return { status: 'test_error' };
      }

      return { status: 'system_error' };
    }
  }
}
