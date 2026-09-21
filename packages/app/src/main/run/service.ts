import type { ChildProcess } from 'node:child_process';
import fsp from 'node:fs/promises';

import { Installer, type InstallStateEvent } from '@electron/fiddle-core';
import { app } from 'electron';

import { parseEnvEntries } from '../../fiddle/env';
import { findMainEntry } from '../../fiddle/files';
import { findPackageManager, installModules } from '../../fiddle/modules';
import { osUserName, toPackageName } from '../../fiddle/package-json';
import { ErrorCode, FiddleError } from '../../shared/errors';
import type { OutputLine, RunState, VersionRefValue } from '../../shared/stores';
import * as documents from '../documents/service';
import { tm } from '../i18n';
import { errorMessage } from '../localize-error';
import { log } from '../log';
import { sfwPathFor } from '../platform/sfw';
import type { StateHub } from '../state-hub';
import type { VersionsService } from '../versions/service';
import {
  classifyRun,
  esmNeedsNewerElectron,
  installRunStatus,
  type RunOutcome,
} from './logic';
import { OutputBuffer } from './output-buffer';
import { OutputParser, type ParseResult } from './output-parser';
import {
  makeRunDir,
  spawnElectron,
  stopChild,
  sweepStaleDirs,
  toolEnv as loadToolEnv,
  waitForExit,
  writeRunApp,
  writeRunPackageJson,
} from './process';

const MAX_ERRORS = 50;
const QUIT_WAIT_MS = 3000;
const MIN_CONSOLE_HEIGHT = 96;
const DEFAULT_CONSOLE_HEIGHT = 160;

export const PM_INSTALL_URLS = {
  npm: 'https://docs.npmjs.com/downloading-and-installing-node-js-and-npm',
  yarn: 'https://yarnpkg.com/getting-started/install',
} as const;

export const IDLE_RUN: RunState = {
  status: 'ready',
  task: 'run',
  errors: [],
  clearedSeq: 0,
  bisect: null,
};

/** A pre-run check refused the run; the message is for the console. */
class Refused extends FiddleError {
  constructor(message: string) {
    super('run-refused', message);
  }
}

interface WindowRun {
  buffer: OutputBuffer;
  abort?: AbortController;
  child?: ChildProcess;
  /** The version the current run uses. */
  version?: VersionRefValue;
  /** The user stopped the current run. */
  stopRequested?: boolean;
}

interface RunOptions {
  /** Run this version instead of the fiddle's (auto bisect). */
  versionRef?: VersionRefValue;
  /** The operation the trust check approves. Default `run`. */
  trustOperation?: documents.CodeExecutingOperation;
  /** A console line to start the run's output with, after the console is cleared. */
  banner?: string;
}

type ConsoleKind = OutputLine['kind'];

export class RunService {
  readonly #hub: StateHub;
  readonly #versions: VersionsService;
  readonly #send: (windowId: string, lines: OutputLine[]) => void;
  readonly #runs = new Map<string, WindowRun>();
  /** Runs and run-dir deletes still going, for a quit to wait for. */
  readonly #tasks = new Set<Promise<unknown>>();
  readonly #stopWaiters = new Set<{ windowId: string; done: () => void }>();
  /** The fiddle each window showed last, to clear its console when another loads. */
  readonly #fiddles = new Map<string, { identity: string; rev: number }>();

  constructor(
    hub: StateHub,
    versions: VersionsService,
    send: (windowId: string, lines: OutputLine[]) => void,
  ) {
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

  log(windowId: string, text: string, kind: ConsoleKind = 'system'): void {
    this.#entry(windowId).buffer.push({ process: 'fiddle', kind, text });
  }

  /** Adds tool output (npm, yarn, Forge), one console line per line. */
  logText(windowId: string, text: string): void {
    for (const line of text.split(/\r?\n/)) {
      if (line.trim() !== '')
        this.#entry(windowId).buffer.push({ process: 'fiddle', kind: 'log', text: line });
    }
  }

  /** Makes sure the console is showing, as a run, package or make does. */
  openConsole(windowId: string): void {
    const layout = this.#hub.getWindow(windowId)?.layout;
    if (layout && (!layout.consoleVisible || layout.consoleHeight < MIN_CONSOLE_HEIGHT)) {
      documents.setLayout(windowId, {
        ...layout,
        consoleVisible: true,
        consoleHeight:
          layout.consoleHeight < MIN_CONSOLE_HEIGHT
            ? DEFAULT_CONSOLE_HEIGHT
            : layout.consoleHeight,
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

  /** The environment for npm, yarn and Forge, for packaging. */
  toolEnv(): Promise<NodeJS.ProcessEnv> {
    return loadToolEnv();
  }

  /**
   * `sfw.mjs`, to wrap an install with when the Socket Firewall setting is on,
   * for runs, package and make alike. Undefined when the setting is off, and
   * throws when it's on but `sfw.mjs` is missing.
   */
  sfwPath(): Promise<string | undefined> {
    return sfwPathFor(this.#hub.app.settings.socketFirewall);
  }

  /**
   * Runs the fiddle and resolves when it exits, with how it ended. A second
   * run in a busy window is `invalid`.
   */
  run(windowId: string, options: RunOptions = {}): Promise<RunOutcome> {
    return this.track(this.#run(windowId, options));
  }

  async #run(windowId: string, options: RunOptions): Promise<RunOutcome> {
    if (this.isBusy(windowId)) return { invalid: true };
    const entry = this.#entry(windowId);
    const settings = this.#hub.app.settings;
    const abort = new AbortController();
    entry.abort = abort;
    entry.stopRequested = false;
    if (settings.clearConsoleOnRun) this.clear(windowId);
    if (options.banner) this.log(windowId, options.banner);
    this.setState(windowId, {
      status: 'checking',
      task: 'run',
      errors: [],
      result: undefined,
    });
    this.openConsole(windowId);

    let dir: string | undefined;
    let outcome: RunOutcome;
    try {
      outcome = await this.#attempt(
        windowId,
        options,
        abort.signal,
        (created) => (dir = created),
      );
    } catch (error) {
      if (error instanceof Refused) {
        this.log(windowId, error.message, 'error');
        outcome = { invalid: true };
      } else if (abort.signal.aborted) {
        this.log(windowId, tm('mainRun')('exitedSignal', { signal: 'SIGTERM' }));
        outcome = { signal: 'SIGTERM' };
      } else {
        const failure = FiddleError.from(error);
        log.error('run failed', failure.code, error);
        this.log(
          windowId,
          tm('mainRun')('runFailed', { message: errorMessage(failure) }),
          'error',
        );
        outcome = { spawnFailed: true };
      }
    } finally {
      entry.abort = undefined;
      entry.child = undefined;
      entry.version = undefined;
    }
    if (entry.stopRequested) outcome = { ...outcome, stopped: true };
    this.setState(windowId, {
      status: 'ready',
      result: outcome.stopped ? undefined : classifyRun(outcome),
    });
    if (dir) this.#removeRunDir(dir);
    return outcome;
  }

  stop(windowId: string): void {
    const entry = this.#runs.get(windowId);
    if (!entry) return;
    if (entry.abort || entry.child) entry.stopRequested = true;
    entry.abort?.abort();
    if (entry.child) stopChild(entry.child);
  }

  /** Stops the window's run, and resolves once the window is ready again or gone. */
  stopAndWait(windowId: string): Promise<void> {
    this.stop(windowId);
    if (!this.isBusy(windowId)) return Promise.resolve();
    return new Promise((resolve) => {
      const waiter = {
        windowId,
        done: () => {
          off();
          this.#stopWaiters.delete(waiter);
          resolve();
        },
      };
      const off = this.#hub.onChange((change) => {
        if (
          change.store === 'window' &&
          change.windowId === windowId &&
          !this.isBusy(windowId)
        )
          waiter.done();
      });
      this.#stopWaiters.add(waiter);
    });
  }

  /** The versions and local builds the runs in progress use, which can't be removed. */
  versionsInUse(): VersionRefValue[] {
    return [...this.#runs.values()].flatMap((entry) =>
      entry.version ? [entry.version] : [],
    );
  }

  hasWork(): boolean {
    return this.#tasks.size > 0;
  }

  /** Stops every run and waits for the children and the deletes, for at most `timeoutMs`. */
  async shutdown(timeoutMs = QUIT_WAIT_MS): Promise<void> {
    for (const windowId of this.#runs.keys()) this.stop(windowId);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(resolve, timeoutMs, 'timeout');
    });
    try {
      while (this.#tasks.size > 0) {
        if (
          (await Promise.race([Promise.allSettled([...this.#tasks]), timedOut])) ===
          'timeout'
        )
          return;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  /** The window closed: stop its run and forget its console. */
  disposeWindow(windowId: string): void {
    this.stop(windowId);
    // A closed window gets no more change events for its waiters to see.
    for (const waiter of [...this.#stopWaiters])
      if (waiter.windowId === windowId) waiter.done();
    this.#runs.get(windowId)?.buffer.dispose();
    this.#runs.delete(windowId);
    this.#fiddles.delete(windowId);
  }

  /** Adds work that a quit waits for, such as a package or make. */
  track<T>(work: Promise<T>): Promise<T> {
    this.#tasks.add(work);
    const done = () => this.#tasks.delete(work);
    work.then(done, done);
    return work;
  }

  #removeRunDir(dir: string): void {
    this.track(
      fsp
        .rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
        .catch((error: unknown) => log.warn('cleanup failed', dir, error)),
    );
  }

  #entry(windowId: string): WindowRun {
    const existing = this.#runs.get(windowId);
    if (existing) return existing;
    const entry: WindowRun = {
      buffer: new OutputBuffer((lines) => this.#send(windowId, lines)),
    };
    // The last lines of a window that has gone have nowhere to show; don't keep a buffer for it.
    if (this.#hub.getWindow(windowId)) {
      this.#runs.set(windowId, entry);
      this.#logReady(windowId, entry);
    }
    return entry;
  }

  /** The console's first line: "Ready. Press Run to start Electron …". */
  #logReady(windowId: string, entry: WindowRun): void {
    const ref = this.#hub.getWindow(windowId)?.fiddle.versionRef;
    if (ref)
      entry.buffer.push({
        process: 'fiddle',
        kind: 'system',
        text: tm('mainRun')('consoleReady', { version: this.#versions.label(ref) }),
      });
  }

  /**
   * A different fiddle loaded: it starts with an empty console and no runtime
   * errors. That needs a new identity and a new `fiddleRev`: saving under a new
   * name changes only the identity, and adding a file bumps only `fiddleRev`.
   */
  #onWindowChange(windowId: string): void {
    const fiddle = this.#hub.getWindow(windowId)?.fiddle;
    if (!fiddle) return;
    const identity = JSON.stringify([fiddle.name, fiddle.source]);
    const last = this.#fiddles.get(windowId);
    this.#fiddles.set(windowId, { identity, rev: fiddle.fiddleRev });
    if (!last || last.identity === identity || last.rev === fiddle.fiddleRev) return;
    const entry = this.#entry(windowId);
    this.setState(windowId, {
      clearedSeq: entry.buffer.clear(),
      errors: [],
      result: undefined,
    });
    this.#logReady(windowId, entry);
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
    const trust = await documents.ensureTrusted(
      windowId,
      options.trustOperation ?? 'run',
    );
    if (!trust.approved) throw new Refused(t('untrusted'));

    const fiddle = trust.fiddle;
    const files = { ...fiddle.files };
    const name = toPackageName(this.#hub.getWindow(windowId)?.fiddle.name ?? 'fiddle');
    const versionRef = options.versionRef ?? fiddle.version;
    this.#entry(windowId).version = versionRef;
    const { exec, label, release } = await this.#resolveElectron(
      windowId,
      versionRef,
      signal,
    );
    this.setState(windowId, { status: 'checking', version: label });
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
    const packageJson = {
      name,
      main: mainEntry,
      author: settings.packageAuthor || osUserName(),
      modules,
    };
    // devDependencies.electron goes in after the module install, or npm and
    // yarn would install Electron as well.
    const withElectron = release
      ? { ...packageJson, electronVersion: release }
      : packageJson;
    const appDir = await writeRunApp(dir, files, hasModules ? packageJson : withElectron);

    if (hasModules) {
      this.setState(windowId, { status: 'installing' });
      this.log(
        windowId,
        trust.allowScripts
          ? t('installingModules', { pm })
          : t('installingModulesNoScripts', { pm }),
      );
      try {
        const sfwPath = await this.sfwPath();
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
        this.log(windowId, t('modulesFailed', { message: errorMessage(error) }), 'error');
        return { installFailed: true };
      }
      await writeRunPackageJson(appDir, withElectron);
    }
    if (signal.aborted) throw new FiddleError(ErrorCode.cancelled, 'The run was stopped');

    this.setState(windowId, { status: 'starting' });
    const userEnv = parseEnvEntries(settings.environmentVariables);
    if (userEnv.invalid.length > 0)
      this.log(
        windowId,
        t('envInvalid', { entries: userEnv.invalid.join(', ') }),
        'warn',
      );
    if (userEnv.blocked.length > 0)
      this.log(windowId, t('envBlocked', { keys: userEnv.blocked.join(', ') }), 'warn');
    const realAppDir = await fsp.realpath(appDir).catch(() => appDir);
    const parser = new OutputParser({
      roots: [...new Set([appDir, realAppDir])],
      files: Object.keys(files),
      chromiumLogs: settings.electronLogging,
    });
    const child = spawnElectron({
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
    // A failed spawn is an `error` event on the next tick, then `close`, so
    // nothing may be awaited between the spawn and these listeners.
    const exited = waitForExit(child, (error) =>
      this.log(windowId, t('spawnFailed', { message: error.message }), 'error'),
    );
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) =>
      this.#consume(windowId, parser.push('stdout', chunk)),
    );
    child.stderr?.on('data', (chunk: string) =>
      this.#consume(windowId, parser.push('stderr', chunk)),
    );
    this.#entry(windowId).child = child;
    this.setState(windowId, { status: 'running' });
    this.log(windowId, t('started', { version: release ? `v${release}` : label, name }));

    const result = await exited;
    this.#consume(windowId, parser.flush());
    if (!result.spawnFailed) {
      this.log(
        windowId,
        result.signal
          ? t('exitedSignal', { signal: result.signal })
          : t('exitedCode', { code: result.code ?? 0 }),
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
      if (!build?.available)
        throw new Refused(t('localBuildMissing', { name: build?.name ?? ref.id }));
      return {
        exec: Installer.getExecPath(build.path),
        label: build.name,
        release: undefined,
      };
    }
    const { version } = ref;
    const row = this.#versions.release(version);
    if (!row) throw new Refused(t('versionUnknown', { version }));
    if (!row.supported) throw new Refused(t('versionUnavailable', { version }));
    let exec = this.#versions.execPath(version);
    if (!exec) {
      this.setState(windowId, { status: 'downloading', version });
      this.log(windowId, t('downloading', { version }));
      const onState = (event: InstallStateEvent) => {
        const status =
          event.version === version ? installRunStatus(event.state) : undefined;
        if (status && this.state(windowId).status !== status)
          this.setState(windowId, { status });
      };
      const { installer } = this.#versions;
      installer.on('state-changed', onState);
      try {
        exec = await this.#versions.install(version, signal);
      } catch (error) {
        if (signal.aborted) throw error;
        throw new Refused(
          t('downloadFailed', { version, message: FiddleError.from(error).message }),
        );
      } finally {
        installer.off('state-changed', onState);
      }
    }
    return { exec, label: version, release: version };
  }

  #consume(windowId: string, result: ParseResult): void {
    const entry = this.#entry(windowId);
    for (const line of result.lines) entry.buffer.push(line);
    if (result.inspectorAddress !== undefined) {
      // The catalog line reads `127.0.0.1:{{port}}`; the id after the port is what authorises an attach.
      this.log(windowId, tm('mainRun')('inspector', { port: result.inspectorAddress }));
    }
    const { errors } = this.state(windowId);
    // Once the list is full, a fiddle that keeps throwing changes nothing.
    if (result.errors.length > 0 && errors.length < MAX_ERRORS) {
      this.setState(windowId, {
        errors: [...errors, ...result.errors].slice(0, MAX_ERRORS),
      });
    }
  }
}

/** Holds quit until running fiddles have exited and their directories are gone. Call once, after `app.whenReady()`. */
export function installRunCleanupOnExit(runs: RunService): void {
  sweepStaleDirs().catch((error: unknown) =>
    log.warn('sweeping old run dirs failed', error),
  );
  let phase: 'idle' | 'stopping' | 'done' = 'idle';
  app.on('will-quit', (event) => {
    if (phase === 'done' || !runs.hasWork()) return;
    // Held again when another handler's `app.quit()` comes before the shutdown ends.
    event.preventDefault();
    if (phase === 'stopping') return;
    phase = 'stopping';
    // `app.quit()` runs on a later turn, never inside a quit event's own dispatch.
    void runs.shutdown().finally(() => {
      phase = 'done';
      setImmediate(() => app.quit());
    });
  });
}
