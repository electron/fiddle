/**
 * Running fiddles (REQUIREMENTS §4 "Fiddle processes", §17.6, §17.7).
 *
 * 1. Trust first (`ensureTrusted`), then the pre-run checks: the version is
 *    installed (or downloads now) or the local build exists, and `main.mjs`
 *    needs Electron 28.
 * 2. The files and `package.json` go into a new `mkdtemp` dir (0700).
 * 3. Modules install with npm or yarn; scripts are off for untrusted fiddles.
 * 4. core's `Runner` spawns Electron with the filtered environment, the
 *    inspector on 127.0.0.1:0 and `ELECTRON_ENABLE_LOGGING`, so renderer
 *    console messages reach stderr and can be mapped to runtime errors.
 * 5. Stop sends SIGTERM, then SIGKILL after a second. Cleanup deletes only the
 *    dir this run created. The fiddle's userData is `<run dir>/user-data`
 *    (`--user-data-dir`), so it goes with it, unless "keep user data dirs" is on.
 */
import type { ChildProcess } from 'node:child_process';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { Fiddle, Installer, Runner } from '@electron/fiddle-core';

import { cleanFlags, fiddleProcessEnv, parseEnvEntries } from '../../fiddle/env';
import { findMainEntry, PACKAGE_JSON } from '../../fiddle/files';
import { writeFiddleFolder } from '../../fiddle/folder';
import { findPackageManager, installModules, loadLoginShellPath } from '../../fiddle/modules';
import { generatePackageJson } from '../../fiddle/package-json';
import { FiddleError } from '../../shared/errors';
import type { OutputLine, RunState, VersionRefValue } from '../../shared/stores';
import * as documents from '../documents/service';
import { tm } from '../i18n';
import { log } from '../log';
import type { StateHub } from '../state-hub';
import type { VersionsService } from '../versions/service';
import { classifyRun, esmNeedsNewerElectron, toPackageName, type RunOutcome, type RunResult } from './logic';
import { OutputBuffer } from './output-buffer';
import { devElectronFlags } from './dev';
import { OutputParser, type ParseResult } from './output-parser';

const STOP_GRACE_MS = 1000;
const MAX_ERRORS = 50;
const MIN_CONSOLE_HEIGHT = 96;
const DEFAULT_CONSOLE_HEIGHT = 160;

export const PM_INSTALL_URLS = {
  npm: 'https://docs.npmjs.com/downloading-and-installing-node-js-and-npm',
  yarn: 'https://yarnpkg.com/getting-started/install',
} as const;

export const IDLE_RUN: RunState = { status: 'ready', task: 'run', errors: [], clearedSeq: 0, bisect: null };

/** A pre-run check refused the run; the message is for the console. */
class Refused extends Error {}

interface WindowRun {
  buffer: OutputBuffer;
  abort?: AbortController;
  child?: ChildProcess;
}

export interface RunOptions {
  /** Run this version instead of the fiddle's (auto bisect). */
  versionRef?: VersionRefValue;
  /** Trust was already checked by the caller (auto bisect). */
  trusted?: { allowScripts: boolean };
}

export type ConsoleKind = OutputLine['kind'];

export class RunService {
  readonly #hub: StateHub;
  readonly #versions: VersionsService;
  readonly #send: (windowId: string, lines: OutputLine[]) => void;
  readonly #runs = new Map<string, WindowRun>();
  #shellPath: Promise<string | undefined> | undefined;

  constructor(hub: StateHub, versions: VersionsService, send: (windowId: string, lines: OutputLine[]) => void) {
    this.#hub = hub;
    this.#versions = versions;
    this.#send = send;
  }

  state(windowId: string): RunState {
    return this.#hub.getWindow(windowId)?.run ?? IDLE_RUN;
  }

  isBusy(windowId: string): boolean {
    return this.state(windowId).status !== 'ready';
  }

  setState(windowId: string, patch: Partial<RunState>): void {
    if (!this.#hub.getWindow(windowId)) return;
    this.#hub.updateWindow(windowId, { run: { ...this.state(windowId), ...patch } });
  }

  /** The backlog for `Run.GetOutput`. */
  output(windowId: string): OutputLine[] {
    const clearedSeq = this.state(windowId).clearedSeq;
    return this.#entry(windowId).buffer.lines.filter((line) => line.seq > clearedSeq);
  }

  clear(windowId: string): void {
    this.setState(windowId, { clearedSeq: this.#entry(windowId).buffer.clear() });
  }

  /** Adds a line from Fiddle itself. */
  log(windowId: string, text: string, kind: ConsoleKind = 'system'): void {
    this.#entry(windowId).buffer.push({ process: 'fiddle', kind, text });
  }

  /** Adds raw tool output (npm, yarn, Forge), line by line. */
  logText(windowId: string, text: string): void {
    for (const line of text.split(/\r?\n/)) {
      if (line.trim() !== '') this.#entry(windowId).buffer.push({ process: 'fiddle', kind: 'log', text: line });
    }
  }

  /** Makes sure the console is open, as a run, package or make does (§17.7). */
  openConsole(windowId: string): void {
    const layout = this.#hub.getWindow(windowId)?.layout;
    if (layout && layout.consoleHeight < MIN_CONSOLE_HEIGHT) {
      documents.setLayout(windowId, { ...layout, consoleHeight: DEFAULT_CONSOLE_HEIGHT });
    }
  }

  /** Runs if ready, otherwise stops. What Run/Stop, ⌘R and F5 do. */
  toggle(windowId: string): void {
    if (this.isBusy(windowId)) this.stop(windowId);
    else this.run(windowId).catch((error: unknown) => log.error('run failed', error));
  }

  /** Starts an abortable operation that isn't a fiddle run (package, make). */
  claim(windowId: string): AbortController {
    const controller = new AbortController();
    this.#entry(windowId).abort = controller;
    return controller;
  }

  release(windowId: string): void {
    const entry = this.#runs.get(windowId);
    if (entry) entry.abort = undefined;
  }

  /** The environment for npm, yarn and Forge: filtered like a fiddle's, with the login shell's PATH. */
  async toolEnv(): Promise<NodeJS.ProcessEnv> {
    this.#shellPath ??= loadLoginShellPath();
    const shellPath = await this.#shellPath;
    const env = fiddleProcessEnv();
    if (shellPath) env.PATH = shellPath;
    return env;
  }

  /** Runs the fiddle and resolves when it exits. A second run in a busy window is ignored. */
  async run(windowId: string, options: RunOptions = {}): Promise<RunResult> {
    if (this.isBusy(windowId)) return 'invalid';
    const entry = this.#entry(windowId);
    const settings = this.#hub.app.settings;
    const abort = new AbortController();
    entry.abort = abort;
    if (settings.clearConsoleOnRun) this.clear(windowId);
    this.setState(windowId, { status: 'starting', task: 'run', errors: [], percent: undefined, result: undefined });
    this.openConsole(windowId);

    let dir: string | undefined;
    let outcome: RunOutcome;
    try {
      outcome = await this.#attempt(windowId, options, abort.signal, (created) => (dir = created));
    } catch (error) {
      if (error instanceof Refused) {
        this.log(windowId, error.message, 'error');
        outcome = { invalid: true };
      } else if (abort.signal.aborted) {
        this.log(windowId, tm('mainRun')('exitedSignal', { signal: 'SIGTERM' }));
        outcome = { signal: 'SIGTERM' };
      } else {
        log.error('run failed', error);
        this.log(windowId, tm('mainRun')('spawnFailed', { message: FiddleError.from(error).message }), 'error');
        outcome = { spawnFailed: true };
      }
    } finally {
      entry.abort = undefined;
      entry.child = undefined;
      if (dir) await fsp.rm(dir, { recursive: true, force: true }).catch((e: unknown) => log.warn('cleanup failed', dir, e));
    }
    const result = classifyRun(outcome);
    this.setState(windowId, { status: 'ready', percent: undefined, result });
    return result;
  }

  stop(windowId: string): void {
    const entry = this.#runs.get(windowId);
    if (!entry) return;
    entry.abort?.abort();
    const child = entry.child;
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    child.kill('SIGTERM');
    const timer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }, STOP_GRACE_MS);
    child.once('exit', () => clearTimeout(timer));
  }

  /** The window closed: stop its run and forget its console. */
  disposeWindow(windowId: string): void {
    this.stop(windowId);
    this.#runs.get(windowId)?.buffer.dispose();
    this.#runs.delete(windowId);
  }

  #entry(windowId: string): WindowRun {
    let entry = this.#runs.get(windowId);
    if (!entry) {
      entry = { buffer: new OutputBuffer((lines) => this.#send(windowId, lines)) };
      this.#runs.set(windowId, entry);
      const ref = this.#hub.getWindow(windowId)?.fiddle.versionRef;
      if (ref) entry.buffer.push({ process: 'fiddle', kind: 'system', text: tm('mainRun')('consoleReady', { version: this.versionLabel(ref) }) });
    }
    return entry;
  }

  versionLabel(ref: VersionRefValue): string {
    return ref.kind === 'release' ? ref.version : (this.#versions.localBuild(ref.id)?.name ?? ref.id);
  }

  async #attempt(
    windowId: string,
    options: RunOptions,
    signal: AbortSignal,
    onDir: (dir: string) => void,
  ): Promise<RunOutcome> {
    const t = tm('mainRun');
    const settings = this.#hub.app.settings;
    const pm = settings.packageManager;

    const trust = options.trusted ?? (await documents.ensureTrusted(windowId, 'run'));
    if ('approved' in trust && !trust.approved) throw new Refused(t('untrusted'));

    const fiddle = documents.getFiddle(windowId);
    const files = documents.getFiddleFiles(windowId);
    const name = this.#hub.getWindow(windowId)?.fiddle.name ?? 'fiddle';
    const { exec, label, release } = await this.#resolveElectron(windowId, options.versionRef ?? fiddle.version, signal);
    const mainEntry = findMainEntry(Object.keys(files)) ?? 'main.js';
    if (esmNeedsNewerElectron(mainEntry, release)) throw new Refused(t('esmNeeds28'));

    const modules = fiddle.modules;
    const hasModules = Object.keys(modules).length > 0;
    const toolEnv = hasModules ? await this.toolEnv() : undefined;
    if (hasModules && !(await findPackageManager(pm, { env: toolEnv }))) {
      throw new Refused(t('pmMissing', { pm, url: PM_INSTALL_URLS[pm] }));
    }

    this.setState(windowId, { status: 'starting', version: label, percent: undefined });
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'electron-fiddle-'));
    onDir(dir);
    const appDir = path.join(dir, 'app');
    const packageJson = generatePackageJson({
      name: toPackageName(name),
      main: mainEntry,
      author: settings.packageAuthor || userName(),
      modules,
    });
    await writeFiddleFolder(appDir, { ...files, [PACKAGE_JSON]: packageJson });

    if (hasModules) {
      this.log(windowId, trust.allowScripts ? t('installingModules', { pm }) : t('installingModulesNoScripts', { pm }));
      // Socket Firewall isn't bundled yet (§15), so installs run without it.
      if (settings.socketFirewall) this.log(windowId, t('noSocketFirewall'), 'warn');
      try {
        await installModules({
          dir: appDir,
          tempRoot: dir,
          packageManager: pm,
          modules,
          ignoreScripts: !trust.allowScripts,
          ...(toolEnv ? { env: toolEnv } : {}),
          signal,
          onOutput: (text) => this.logText(windowId, text),
        });
      } catch (error) {
        if (signal.aborted) throw error;
        this.log(windowId, t('modulesFailed', { message: FiddleError.from(error).message }), 'error');
        return { installFailed: true };
      }
    }
    if (signal.aborted) throw new Error('aborted');

    const userEnv = parseEnvEntries(settings.environmentVariables);
    if (userEnv.invalid.length > 0) this.log(windowId, t('envInvalid', { entries: userEnv.invalid.join(', ') }), 'warn');
    if (userEnv.blocked.length > 0) this.log(windowId, t('envBlocked', { keys: userEnv.blocked.join(', ') }), 'warn');
    const args = [...cleanFlags(settings.electronFlags), ...devElectronFlags()];
    if (!settings.keepUserDataDirs) args.unshift(`--user-data-dir=${path.join(dir, 'user-data')}`);

    const runner = await Runner.create({
      installer: this.#versions.installer,
      versions: this.#versions.electronVersions,
      errors: 'typed',
    });
    const child = await runner.spawn(exec, new Fiddle(appDir, 'fiddle'), {
      args,
      showConfig: false,
      cwd: appDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      // Always log: renderer console messages reach stderr, for runtime errors.
      env: fiddleProcessEnv({
        userEnv: { ELECTRON_ENABLE_LOGGING: 'true', ...userEnv.env },
        advancedLogging: settings.electronLogging,
      }),
      inspect: { host: '127.0.0.1', port: 0 },
    });
    const entry = this.#entry(windowId);
    entry.child = child;
    this.setState(windowId, { status: 'running' });
    this.log(windowId, t('started', { version: label, arch: process.arch }));

    const realAppDir = await fsp.realpath(appDir).catch(() => appDir);
    const parser = new OutputParser({
      roots: [...new Set([appDir, realAppDir])],
      files: Object.keys(files),
      chromiumLogs: settings.electronLogging,
    });
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => this.#consume(windowId, parser.push('stdout', chunk)));
    child.stderr?.on('data', (chunk: string) => this.#consume(windowId, parser.push('stderr', chunk)));

    const result = await new Promise<RunOutcome>((resolve) => {
      let failed = false;
      child.once('error', (error) => {
        failed = true;
        this.log(windowId, t('spawnFailed', { message: error.message }), 'error');
      });
      child.once('close', (code, exitSignal) => resolve(failed ? { spawnFailed: true } : { code, signal: exitSignal }));
    });
    this.#consume(windowId, parser.flush());
    if (!result.spawnFailed) {
      this.log(
        windowId,
        result.signal ? t('exitedSignal', { signal: result.signal }) : t('exitedCode', { code: result.code ?? 0 }),
      );
    }
    return result;
  }

  async #resolveElectron(
    windowId: string,
    ref: VersionRefValue,
    signal: AbortSignal,
  ): Promise<{ exec: string; label: string; release: string | undefined }> {
    const t = tm('mainRun');
    if (ref.kind === 'local') {
      const build = this.#versions.localBuild(ref.id);
      if (!build?.available) throw new Refused(t('localBuildMissing', { name: build?.name ?? ref.id }));
      return { exec: Installer.getExecPath(build.path), label: build.name, release: undefined };
    }
    const { version } = ref;
    const row = this.#versions.release(version);
    if (!row) throw new Refused(t('versionUnknown', { version }));
    if (!row.supported) throw new Refused(t('versionUnavailable', { version }));
    let exec = this.#versions.execPath(version);
    if (!exec) {
      this.setState(windowId, { status: 'downloading', version });
      this.log(windowId, t('downloading', { version }));
      try {
        exec = await this.#versions.install(version, signal);
      } catch (error) {
        if (signal.aborted) throw error;
        throw new Refused(t('downloadFailed', { version, message: FiddleError.from(error).message }));
      }
    }
    return { exec, label: version, release: version };
  }

  #consume(windowId: string, result: ParseResult): void {
    const entry = this.#entry(windowId);
    for (const line of result.lines) entry.buffer.push(line);
    if (result.inspectorPort !== undefined) {
      this.log(windowId, tm('mainRun')('inspector', { port: result.inspectorPort }));
    }
    if (result.errors.length > 0) {
      this.setState(windowId, { errors: [...this.state(windowId).errors, ...result.errors].slice(0, MAX_ERRORS) });
    }
  }
}

function userName(): string {
  try {
    return os.userInfo().username;
  } catch {
    return '';
  }
}
