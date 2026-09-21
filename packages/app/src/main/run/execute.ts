import fsp from 'node:fs/promises';

import { parseEnvEntries } from '../../fiddle/env';
import { findMainEntry, type FileMap } from '../../fiddle/files';
import { killTree } from '../../fiddle/kill-tree';
import {
  findPackageManager,
  installModules,
  PM_INSTALL_URLS,
} from '../../fiddle/modules';
import { osUserName, toPackageName } from '../../fiddle/package-json';
import { ErrorCode, FiddleError } from '../../shared/errors';
import type { Settings } from '../../shared/settings';
import { tm } from '../i18n';
import { sfwPathFor } from '../platform/sfw';
import { esmNeedsNewerElectron, type RunOutcome } from './logic';
import { OutputParser, type ParseResult } from './output-parser';
import {
  spawnElectron,
  toolEnv,
  waitForExit,
  writeRunApp,
  writeRunPackageJson,
} from './process';

/** A pre-run check refused the run. The message is for the console; the code is for the CLI's exit status. */
export class RunRefused extends FiddleError {}

export interface RunJob {
  /** From `makeRunDir`. The caller removes it once the run is over. */
  dir: string;
  files: FileMap;
  modules: Readonly<Record<string, string>>;
  /** The fiddle's name, for its package.json. */
  name: string;
  electron: { exec: string; label: string; release?: string | undefined };
  /** A trusted fiddle's install scripts run. */
  allowScripts: boolean;
  /** The Execution settings: package manager and author, Socket Firewall, environment, flags and logging. */
  settings: Settings;
  signal: AbortSignal;
}

/** Where a run reports. The app's console takes `parsed` output; the CLI takes it raw. */
export interface RunSink {
  log(text: string, level?: 'warn' | 'error'): void;
  /** npm or yarn output. */
  tool(text: string): void;
  status?(status: 'installing' | 'starting' | 'running'): void;
  /** Electron's output mapped to fiddle files, with the inspector on; or else raw chunks, flushed at exit. */
  parsed?(result: ParseResult): void;
  output?(stream: 'stdout' | 'stderr', chunk: string): void;
  flush?(): void;
  /** A failed module install ends the run with this outcome. Without it the error is thrown. */
  installFailed?(error: unknown): RunOutcome;
}

/**
 * Writes the fiddle to `job.dir`, installs its modules, starts Electron and
 * resolves with how it ended. An abort stops whichever of those is going.
 */
export async function executeRun(job: RunJob, on: RunSink): Promise<RunOutcome> {
  const t = tm('mainRun');
  const { files, modules, electron, settings, signal } = job;
  const pm = settings.packageManager;
  const mainEntry = findMainEntry(Object.keys(files)) ?? 'main.js';
  if (esmNeedsNewerElectron(mainEntry, electron.release))
    throw new RunRefused(ErrorCode.invalidArgument, t('esmNeeds28'));
  const hasModules = Object.keys(modules).length > 0;
  const env = hasModules ? await toolEnv() : undefined;
  if (hasModules && !(await findPackageManager(pm, env))) {
    throw new RunRefused(
      ErrorCode.unavailable,
      t('pmMissing', { pm, url: PM_INSTALL_URLS[pm] }),
    );
  }

  const name = toPackageName(job.name);
  const author = settings.packageAuthor || osUserName();
  const packageJson = { name, main: mainEntry, author, modules };
  // devDependencies.electron goes in after the module install, or npm and
  // yarn would install Electron as well.
  const withElectron = electron.release
    ? { ...packageJson, electronVersion: electron.release }
    : packageJson;
  const appDir = await writeRunApp(
    job.dir,
    files,
    hasModules ? packageJson : withElectron,
  );
  if (hasModules) {
    on.status?.('installing');
    on.log(
      job.allowScripts
        ? t('installingModules', { pm })
        : t('installingModulesNoScripts', { pm }),
    );
    try {
      await installModules({
        dir: appDir,
        tempRoot: job.dir,
        packageManager: pm,
        modules,
        ignoreScripts: !job.allowScripts,
        sfwPath: await sfwPathFor(settings.socketFirewall),
        env,
        signal,
        onOutput: on.tool,
      });
    } catch (error) {
      if (signal.aborted || !on.installFailed) throw error;
      return on.installFailed(error);
    }
    await writeRunPackageJson(appDir, withElectron);
  }

  on.status?.('starting');
  const userEnv = parseEnvEntries(settings.environmentVariables);
  if (userEnv.invalid.length > 0)
    on.log(t('envInvalid', { entries: userEnv.invalid.join(', ') }), 'warn');
  if (userEnv.blocked.length > 0)
    on.log(t('envBlocked', { keys: userEnv.blocked.join(', ') }), 'warn');
  const realAppDir = await fsp.realpath(appDir).catch(() => appDir);
  const parser =
    on.parsed &&
    new OutputParser({
      roots: [...new Set([appDir, realAppDir])],
      files: Object.keys(files),
      chromiumLogs: settings.electronLogging,
    });
  signal.throwIfAborted();
  const child = spawnElectron({
    exec: electron.exec,
    appDir,
    runDir: job.dir,
    flags: settings.electronFlags,
    keepUserDataDirs: settings.keepUserDataDirs,
    // Always log: renderer console messages reach stderr, for runtime errors.
    env: { ELECTRON_ENABLE_LOGGING: 'true', ...userEnv.env },
    advancedLogging: settings.electronLogging,
    // The console shows the inspector port; raw output has nowhere to.
    inspect: parser !== undefined,
  });
  // A failed spawn is an `error` event on the next tick, then `close`, so
  // nothing may be awaited between the spawn and these listeners.
  const exited = waitForExit(child, (error) =>
    on.log(t('spawnFailed', { message: error.message }), 'error'),
  );
  const stop = () => killTree(child);
  signal.addEventListener('abort', stop);
  for (const stream of ['stdout', 'stderr'] as const) {
    child[stream]?.setEncoding('utf8');
    child[stream]?.on('data', (chunk: string) => {
      if (parser) on.parsed?.(parser.push(stream, chunk));
      else on.output?.(stream, chunk);
    });
  }
  on.status?.('running');
  const version = electron.release ? `v${electron.release}` : electron.label;
  on.log(t('started', { version, name }));

  const result = await exited;
  signal.removeEventListener('abort', stop);
  if (parser) on.parsed?.(parser.flush());
  else on.flush?.();
  if (!result.spawnFailed) {
    on.log(
      result.signal
        ? t('exitedSignal', { signal: result.signal })
        : t('exitedCode', { code: result.code ?? 0 }),
    );
  }
  return result;
}
