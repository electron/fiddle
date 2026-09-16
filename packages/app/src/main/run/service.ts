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
 *
 * The Run control follows `Window.run.status` through §17.6's states:
 * checking, downloading and unzipping (the version), installing (modules),
 * starting and running.
 */
import type { ChildProcess } from 'node:child_process';
import fsp from 'node:fs/promises';

import { Installer, type InstallStateEvent } from '@electron/fiddle-core';

import { parseEnvEntries } from '../../fiddle/env';
import { findMainEntry } from '../../fiddle/files';
import { findPackageManager, installModules } from '../../fiddle/modules';
import { FiddleError } from '../../shared/errors';
import type { OutputLine, RunState, VersionRefValue } from '../../shared/stores';
import * as documents from '../documents/service';
import { tm } from '../i18n';
import { log } from '../log';
import { sfwEntryPath } from '../platform/sfw';
import type { StateHub } from '../state-hub';
import type { VersionsService } from '../versions/service';
import {
  classifyRun,
  esmNeedsNewerElectron,
  installRunStatus,
  toPackageName,
  type RunOutcome,
  type RunResult,
} from './logic';
import { OutputBuffer } from './output-buffer';
import { OutputParser, type ParseResult } from './output-parser';
import {
  makeRunDir,
  spawnElectron,
  stopChild,
  toolEnv as loadToolEnv,
  userName,
  waitForExit,
  writeRunApp,
  writeRunPackageJson,
} from './process';

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

interface RunOptions {
  /** Run this version instead of the fiddle's (auto bisect). */
  versionRef?: VersionRefValue;
  /** The operation the trust check approves. Default `run`. */
  trustOperation?: documents.CodeExecutingOperation;
}

type ConsoleKind = OutputLine['kind'];

export class RunService {
  readonly #hub: StateHub;
  readonly #versions: VersionsService;
  readonly #send: (windowId: string, lines: OutputLine[]) => void;
  readonly #runs = new Map<string, WindowRun>();
  /** The fiddle each window showed last, to clear its console when another loads. */
  readonly #fiddles = new Map<string, { identity: string; rev: number }>();

  constructor(hub: StateHub, versions: VersionsService, send: (windowId: string, lines: OutputLine[]) => void) {
    this.#hub = hub;
    this.#versions = versions;
    this.#send = send;
    hub.onChange((change) => {
      if (change.store === 'window') this.#onWindowChange(change.windowId);
    });
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

  /** Makes sure the console is showing, as a run, package or make does (§17.7). */
  openConsole(windowId: string): void {
    const layout = this.#hub.getWindow(windowId)?.layout;
    if (layout && (!layout.consoleVisible || layout.consoleHeight < MIN_CONSOLE_HEIGHT)) {
      documents.setLayout(windowId, {
        ...layout,
        consoleVisible: true,
        consoleHeight: layout.consoleHeight < MIN_CONSOLE_HEIGHT ? DEFAULT_CONSOLE_HEIGHT : layout.consoleHeight,
      });
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
  toolEnv(): Promise<NodeJS.ProcessEnv> {
    return loadToolEnv();
  }

  /**
   * `sfw.mjs`, to wrap an install with when the Socket Firewall setting is on
   * (§4), for runs, package and make alike. Undefined when the setting is off,
   * and, with a console warning, when it's on but `sfw.mjs` is missing.
   */
  sfwPath(windowId: string): string | undefined {
    const enabled = this.#hub.app.settings.socketFirewall;
    const file = enabled ? sfwEntryPath() : undefined;
    if (enabled && !file) this.log(windowId, tm('mainRun')('noSocketFirewall'), 'warn');
    return file;
  }

  /** Runs the fiddle and resolves when it exits. A second run in a busy window is ignored. */
  async run(windowId: string, options: RunOptions = {}): Promise<RunResult> {
    if (this.isBusy(windowId)) return 'invalid';
    const entry = this.#entry(windowId);
    const settings = this.#hub.app.settings;
    const abort = new AbortController();
    entry.abort = abort;
    if (settings.clearConsoleOnRun) this.clear(windowId);
    this.setState(windowId, { status: 'checking', task: 'run', errors: [], percent: undefined, result: undefined });
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
    if (entry.child) stopChild(entry.child);
  }

  /** The window closed: stop its run and forget its console. */
  disposeWindow(windowId: string): void {
    this.stop(windowId);
    this.#runs.get(windowId)?.buffer.dispose();
    this.#runs.delete(windowId);
    this.#fiddles.delete(windowId);
  }

  #entry(windowId: string): WindowRun {
    let entry = this.#runs.get(windowId);
    if (!entry) {
      entry = { buffer: new OutputBuffer((lines) => this.#send(windowId, lines)) };
      this.#runs.set(windowId, entry);
      this.#logReady(windowId, entry);
    }
    return entry;
  }

  /** The console's first line: "Ready. Press Run to start Electron …". */
  #logReady(windowId: string, entry: WindowRun): void {
    const ref = this.#hub.getWindow(windowId)?.fiddle.versionRef;
    if (ref) entry.buffer.push({ process: 'fiddle', kind: 'system', text: tm('mainRun')('consoleReady', { version: this.versionLabel(ref) }) });
  }

  /**
   * A different fiddle loaded: it starts with an empty console and no runtime
   * errors (§17.4). Keyed on the fiddle's identity, like the shell, and only
   * when the editor text was replaced too: saving under a new name changes the
   * identity but not `fiddleRev`, and adding a file bumps `fiddleRev` only.
   */
  #onWindowChange(windowId: string): void {
    const fiddle = this.#hub.getWindow(windowId)?.fiddle;
    if (!fiddle) return;
    const identity = JSON.stringify([fiddle.name, fiddle.source]);
    const last = this.#fiddles.get(windowId);
    this.#fiddles.set(windowId, { identity, rev: fiddle.fiddleRev });
    if (!last || last.identity === identity || last.rev === fiddle.fiddleRev) return;
    const entry = this.#entry(windowId);
    this.setState(windowId, { clearedSeq: entry.buffer.clear(), errors: [], result: undefined });
    this.#logReady(windowId, entry);
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

    // Every run checks trust, auto-bisect steps included: it's free once the
    // fiddle is approved, and asks again if the window's fiddle has another
    // origin since. Exactly the approved fiddle runs, whatever the window loads next.
    const trust = await documents.ensureTrusted(windowId, options.trustOperation ?? 'run');
    if (!trust.approved) throw new Refused(t('untrusted'));

    const fiddle = trust.fiddle;
    const files = { ...fiddle.files };
    const name = toPackageName(this.#hub.getWindow(windowId)?.fiddle.name ?? 'fiddle');
    const { exec, label, release } = await this.#resolveElectron(windowId, options.versionRef ?? fiddle.version, signal);
    this.setState(windowId, { status: 'checking', version: label, percent: undefined });
    const mainEntry = findMainEntry(Object.keys(files)) ?? 'main.js';
    if (esmNeedsNewerElectron(mainEntry, release)) throw new Refused(t('esmNeeds28'));

    const modules = fiddle.modules;
    const hasModules = Object.keys(modules).length > 0;
    const toolEnv = hasModules ? await this.toolEnv() : undefined;
    if (hasModules && !(await findPackageManager(pm, { env: toolEnv }))) {
      throw new Refused(t('pmMissing', { pm, url: PM_INSTALL_URLS[pm] }));
    }

    const dir = await makeRunDir();
    onDir(dir);
    const packageJson = { name, main: mainEntry, author: settings.packageAuthor || userName(), modules };
    // devDependencies.electron (§17.3) goes in after the module install, or
    // npm and yarn would install Electron as well.
    const withElectron = release ? { ...packageJson, electronVersion: release } : packageJson;
    const appDir = await writeRunApp(dir, files, hasModules ? packageJson : withElectron);

    if (hasModules) {
      this.setState(windowId, { status: 'installing' });
      this.log(windowId, trust.allowScripts ? t('installingModules', { pm }) : t('installingModulesNoScripts', { pm }));
      // Socket Firewall wraps the install when it's on and `sfw.mjs` is there (§4).
      const sfwPath = this.sfwPath(windowId);
      try {
        await installModules({
          dir: appDir,
          tempRoot: dir,
          packageManager: pm,
          modules,
          ignoreScripts: !trust.allowScripts,
          ...(sfwPath ? { sfwPath } : {}),
          ...(toolEnv ? { env: toolEnv } : {}),
          signal,
          onOutput: (text) => this.logText(windowId, text),
        });
      } catch (error) {
        if (signal.aborted) throw error;
        this.log(windowId, t('modulesFailed', { message: FiddleError.from(error).message }), 'error');
        return { installFailed: true };
      }
      await writeRunPackageJson(appDir, withElectron);
    }
    if (signal.aborted) throw new Error('aborted');

    this.setState(windowId, { status: 'starting' });
    const userEnv = parseEnvEntries(settings.environmentVariables);
    if (userEnv.invalid.length > 0) this.log(windowId, t('envInvalid', { entries: userEnv.invalid.join(', ') }), 'warn');
    if (userEnv.blocked.length > 0) this.log(windowId, t('envBlocked', { keys: userEnv.blocked.join(', ') }), 'warn');
    const child = await spawnElectron({
      installer: this.#versions.installer,
      versions: this.#versions.electronVersions,
      exec,
      appDir,
      runDir: dir,
      flags: settings.electronFlags,
      keepUserDataDirs: settings.keepUserDataDirs,
      // Always log: renderer console messages reach stderr, for runtime errors.
      env: { ELECTRON_ENABLE_LOGGING: 'true', ...userEnv.env },
      advancedLogging: settings.electronLogging,
      inspect: true,
    });
    const entry = this.#entry(windowId);
    entry.child = child;
    this.setState(windowId, { status: 'running' });
    this.log(windowId, t('started', { version: release ? `v${release}` : label, name }));

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

    const result = await waitForExit(child, (error) =>
      this.log(windowId, t('spawnFailed', { message: error.message }), 'error'),
    );
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
      // Downloading, then unzipping, as core's installer reports them.
      const onState = (event: InstallStateEvent) => {
        const status = event.version === version ? installRunStatus(event.state) : undefined;
        if (status && this.state(windowId).status !== status) this.setState(windowId, { status });
      };
      const { installer } = this.#versions;
      installer.on('state-changed', onState);
      try {
        exec = await this.#versions.install(version, signal);
      } catch (error) {
        if (signal.aborted) throw error;
        throw new Refused(t('downloadFailed', { version, message: FiddleError.from(error).message }));
      } finally {
        installer.off('state-changed', onState);
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
