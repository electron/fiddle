import { execFile, spawn } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import * as path from 'node:path';

import * as semver from 'semver';
import { z } from 'zod';

import { ErrorCode, FiddleError } from '../shared/errors';
import { envFromEntries, fiddleProcessEnv } from './env';

export type PackageManager = 'npm' | 'yarn';
export type ModuleSpecProblem = 'invalid-name' | 'invalid-spec';

export interface CommandLine {
  command: string;
  args: string[];
  /** Variables added to the command's environment. */
  env?: Record<string, string>;
}

// Registry package names: optional scope, URL-safe characters, no leading `.`, `_` or `-`
// (a leading `-` would read as a flag). Upper case is allowed because legacy packages (e.g. JSONStream) use it.
const NAME_RE = /^(?:@[a-z0-9~][a-z0-9._~-]*\/)?[a-z0-9~][a-z0-9._~-]*$/i;
const DIST_TAG_RE = /^[a-z][a-z0-9._-]*$/i;

export function isValidPackageName(name: string): boolean {
  return (
    name.length > 0 &&
    name.length <= 214 &&
    NAME_RE.test(name) &&
    !['node_modules', 'favicon.ico'].includes(name.toLowerCase())
  );
}

/** A semver range or a dist-tag. Git, URL, `file:`, alias (`npm:`) and path specs are rejected. */
export function isValidVersionSpec(spec: string): boolean {
  if (spec === '' || spec.trim() !== spec) return false;
  if (/[:/\\@#%"']/.test(spec)) return false;
  return semver.validRange(spec) !== null || DIST_TAG_RE.test(spec);
}

export function checkModuleSpec(name: string, spec: string): ModuleSpecProblem | null {
  if (!isValidPackageName(name)) return 'invalid-name';
  if (!isValidVersionSpec(spec)) return 'invalid-spec';
  return null;
}

export function assertModuleSpec(name: string, spec: string): void {
  const reason = checkModuleSpec(name, spec);
  if (reason) {
    throw new FiddleError(
      ErrorCode.invalidArgument,
      `Unsupported module spec: ${name}@${spec}`,
      {
        reason,
        name,
        spec,
      },
    );
  }
}

/** Keeps exact semver versions. Anything else (`*`, ranges, tags) becomes `latest` when it's known. */
export function normalizeModuleVersion(
  version: string,
  latest: string | undefined,
): string {
  return semver.valid(version) ? version : (latest ?? version);
}

/** The newest stable version in a package's version list. */
export function pickLatestVersion(versions: readonly string[]): string | undefined {
  return semver.maxSatisfying([...versions], '*') ?? undefined;
}

export interface InstallCommandOptions {
  packageManager: PackageManager;
  modules?: Readonly<Record<string, string>>;
  ignoreScripts?: boolean;
  /** Path to `sfw.mjs`. When set, the install runs as `node <sfwPath> npm|yarn ...`. */
  sfwPath?: string;
}

/**
 * Turns dependency lifecycle scripts off through the environment: npm and
 * Yarn 1 read `npm_config_ignore_scripts`, Yarn 2+ reads `YARN_ENABLE_SCRIPTS`
 * (and rejects `--ignore-scripts`).
 */
export const IGNORE_SCRIPTS_ENV: Readonly<Record<string, string>> = {
  npm_config_ignore_scripts: 'true',
  YARN_ENABLE_SCRIPTS: 'false',
};

/** `npm install -S -- <specs>` or `yarn add -- <specs>` (`yarn install` with no modules). */
export function buildInstallCommand(options: InstallCommandOptions): CommandLine {
  const specs = Object.entries(options.modules ?? {}).map(([name, spec]) => {
    assertModuleSpec(name, spec);
    return `${name}@${spec}`;
  });
  const pm = options.packageManager === 'yarn' ? 'yarn' : 'npm';
  const pmArgs =
    specs.length === 0
      ? pm === 'npm'
        ? ['install', '-S']
        : ['install']
      : pm === 'npm'
        ? ['install', '-S', '--', ...specs]
        : ['add', '--', ...specs];
  const line: CommandLine = options.sfwPath
    ? { command: 'node', args: [options.sfwPath, pm, ...pmArgs] }
    : { command: pm, args: pmArgs };
  if (options.ignoreScripts) line.env = { ...IGNORE_SCRIPTS_ENV };
  return line;
}

/** `<pm> run <script>`, for Forge package and make. */
export function buildRunScriptCommand(
  packageManager: PackageManager,
  script: string,
): CommandLine {
  return { command: packageManager === 'yarn' ? 'yarn' : 'npm', args: ['run', script] };
}

export type ExecFn = (
  file: string,
  args: readonly string[],
  options: { env?: NodeJS.ProcessEnv; timeout?: number },
) => Promise<string>;

const defaultExec: ExecFn = (file, args, options) =>
  new Promise((resolve, reject) => {
    execFile(
      file,
      [...args],
      { ...options, encoding: 'utf8', windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout) => (error ? reject(error) : resolve(stdout)),
    );
  });

export interface HostOptions {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  exec?: ExecFn;
}

/** The package manager's path via `which` (`where.exe` on Windows), or null if it isn't on PATH. */
export async function findPackageManager(
  pm: PackageManager,
  options: HostOptions = {},
): Promise<string | null> {
  const win = (options.platform ?? process.platform) === 'win32';
  const exec = options.exec ?? defaultExec;
  try {
    const stdout = await exec(win ? 'where.exe' : 'which', [pm], {
      env: options.env ?? process.env,
    });
    return stdout.split(/\r?\n/)[0]?.trim() || null;
  } catch {
    return null;
  }
}

const PATH_MARKER = '__FIDDLE_SHELL_PATH__';

/**
 * The PATH from the user's login shell on macOS and Linux, so npm and yarn
 * installed through shell profiles are found. Undefined on Windows or failure.
 */
export async function loadLoginShellPath(
  options: HostOptions & { timeoutMs?: number } = {},
): Promise<string | undefined> {
  const platform = options.platform ?? process.platform;
  if (platform === 'win32') return undefined;
  const env = options.env ?? process.env;
  const shell = env.SHELL || (platform === 'darwin' ? '/bin/zsh' : '/bin/sh');
  const exec = options.exec ?? defaultExec;
  try {
    const stdout = await exec(
      shell,
      ['-ilc', `echo ${PATH_MARKER}; printenv PATH; echo ${PATH_MARKER}`],
      {
        env: { ...env, DISABLE_AUTO_UPDATE: 'true' },
        timeout: options.timeoutMs ?? 10_000,
      },
    );
    const value = stdout
      .split(PATH_MARKER)[1]
      // eslint-disable-next-line no-control-regex
      ?.replace(/\[[0-9;?]*[A-Za-z]/g, '')
      .trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

export interface RunCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  onOutput?: (text: string) => void;
  platform?: NodeJS.Platform;
}

export interface CommandResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  /** Combined stdout and stderr (the last 1 MB). */
  output: string;
}

const MAX_OUTPUT = 1024 * 1024;

/**
 * Spawns a command and collects its output. On Windows it runs through the
 * shell (npm and yarn are `.cmd` files) with every argument double-quoted;
 * arguments containing `"`, `%` or newlines are refused there.
 */
export function runCommand(
  line: CommandLine,
  options: RunCommandOptions = {},
): Promise<CommandResult> {
  const win = (options.platform ?? process.platform) === 'win32';
  if (win && line.args.some((a) => /["%\r\n]/.test(a))) {
    return Promise.reject(
      new FiddleError(ErrorCode.invalidArgument, 'Argument not allowed on Windows'),
    );
  }
  if (options.signal?.aborted) {
    return Promise.reject(
      new FiddleError(ErrorCode.cancelled, `${line.command} was cancelled`),
    );
  }
  return new Promise((resolve, reject) => {
    const child = spawn(line.command, win ? line.args.map((a) => `"${a}"`) : line.args, {
      cwd: options.cwd,
      env: options.env,
      signal: options.signal,
      shell: win,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const onData = (text: string) => {
      output = (output + text).slice(-MAX_OUTPUT);
      options.onOutput?.(text);
    };
    // Strings, so a multi-byte character split between two chunks stays whole.
    child.stdout?.setEncoding('utf8').on('data', onData);
    child.stderr?.setEncoding('utf8').on('data', onData);
    child.once('error', (error: NodeJS.ErrnoException) => {
      if (options.signal?.aborted || error.name === 'AbortError') {
        reject(new FiddleError(ErrorCode.cancelled, `${line.command} was cancelled`));
      } else {
        reject(
          new FiddleError(
            ErrorCode.unavailable,
            `Could not start ${line.command}: ${error.message}`,
            {
              command: line.command,
              errno: error.code,
            },
          ),
        );
      }
    });
    child.once('close', (code, signal) => {
      if (options.signal?.aborted)
        reject(new FiddleError(ErrorCode.cancelled, `${line.command} was cancelled`));
      else resolve({ code, signal, output });
    });
  });
}

/** Throws unless `dir` is `root` or inside it, after resolving symlinks. */
export async function assertInsideDir(root: string, dir: string): Promise<void> {
  const [realRoot, realDir] = await Promise.all([realpath(root), realpath(dir)]);
  const rel = path.relative(realRoot, realDir);
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new FiddleError(
      ErrorCode.invalidArgument,
      'Modules can only be installed in a temp directory',
      { dir },
    );
  }
}

export interface InstallModulesOptions extends InstallCommandOptions {
  /** Where to install. Must be `tempRoot` or inside it. */
  dir: string;
  tempRoot: string;
  /** Default: `fiddleProcessEnv()`, the parent environment minus the denylist. */
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  onOutput?: (text: string) => void;
  platform?: NodeJS.Platform;
}

/** Runs the install in `dir`. Throws `install-failed` on a non-zero exit and `cancelled` on abort. */
export async function installModules(
  options: InstallModulesOptions,
): Promise<CommandResult> {
  await assertInsideDir(options.tempRoot, options.dir);
  const line = buildInstallCommand(options);
  const env = envFromEntries(
    [
      ...Object.entries(options.env ?? fiddleProcessEnv()),
      ...Object.entries(line.env ?? {}),
    ],
    options.platform,
  );
  const result = await runCommand(line, {
    cwd: options.dir,
    env,
    signal: options.signal,
    onOutput: options.onOutput,
    platform: options.platform,
  });
  if (result.code !== 0) {
    throw new FiddleError(
      ErrorCode.installFailed,
      `${options.packageManager} exited with ${result.code ?? result.signal}`,
      { code: result.code, signal: result.signal, output: result.output.slice(-4000) },
    );
  }
  return result;
}

/** Fetches a package's registry metadata. */
export type RegistryFetch = (name: string, signal?: AbortSignal) => Promise<unknown>;

const PackumentSchema = z.object({
  'dist-tags': z.record(z.string(), z.string()).optional(),
  versions: z.record(z.string(), z.object({ hasInstallScript: z.boolean().optional() })),
});

export interface InstallScriptPackage {
  name: string;
  /** The version the spec resolves to. */
  version: string;
}

/**
 * The modules whose resolved version has an install script, from registry
 * metadata, so the run approval can list them. Only direct dependencies are
 * checked. Specs that don't resolve are left out, since their install fails.
 */
export async function findInstallScripts(
  modules: Readonly<Record<string, string>>,
  registryFetch: RegistryFetch,
  signal?: AbortSignal,
): Promise<InstallScriptPackage[]> {
  const found = await Promise.all(
    Object.entries(modules).map(
      async ([name, spec]): Promise<InstallScriptPackage | null> => {
        const parsed = PackumentSchema.safeParse(await registryFetch(name, signal));
        if (!parsed.success)
          throw new FiddleError(
            ErrorCode.internal,
            `Unexpected registry metadata for ${name}`,
            { name },
          );
        const tags = parsed.data['dist-tags'] ?? {};
        const { versions } = parsed.data;
        const version = Object.hasOwn(tags, spec)
          ? tags[spec]
          : semver.maxSatisfying(Object.keys(versions), spec);
        return version &&
          Object.hasOwn(versions, version) &&
          versions[version]!.hasInstallScript
          ? { name, version }
          : null;
      },
    ),
  );
  return found.filter((p) => p !== null);
}
