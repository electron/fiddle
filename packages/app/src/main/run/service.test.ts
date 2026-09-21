/** The run lifecycle, with `spawnElectron` returning a fake child. */
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { pathToFileURL } from 'node:url';

import { Installer } from '@electron/fiddle-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OutputLine, RunState, VersionRefValue } from '../../shared/stores';

const spawnElectron = vi.fn();
const ensureTrusted = vi.fn();
const modules = vi.hoisted(() => ({
  findPackageManager: vi.fn<() => Promise<string | undefined>>(),
  installModules: vi.fn<(options: { onOutput(text: string): void }) => Promise<void>>(),
}));
const setLayout = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({ app: { on: vi.fn(), quit: vi.fn(), isPackaged: false } }));
vi.mock('../documents/service', () => ({
  ensureTrusted: (...args: unknown[]) => ensureTrusted(...args),
  setLayout,
}));
vi.mock('../../fiddle/modules', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../fiddle/modules')>()),
  findPackageManager: modules.findPackageManager,
  installModules: modules.installModules,
  // `toolEnv()` would otherwise spawn the real login shell for its PATH.
  loadLoginShellPath: async () => undefined,
}));
vi.mock('../i18n', () => ({
  tm: () => (key: string, options?: Record<string, unknown>) =>
    options ? `${key}:${JSON.stringify(options)}` : key,
}));
vi.mock('../log', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('./process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./process')>()),
  spawnElectron: (...args: unknown[]) => spawnElectron(...args),
  sweepStaleDirs: async () => undefined,
  // The fake child has no pid for a process-tree kill. That is tested in kill-tree.test.ts.
  stopChild: (child: { kill(signal: string): boolean }) => child.kill('SIGTERM'),
}));

const { app } = await import('electron');
const { RunService, installRunCleanupOnExit } = await import('./service');

const VERSION = '30.0.0';
const ref = { kind: 'release' as const, version: VERSION };

interface FakeChild extends EventEmitter {
  stdout: PassThrough;
  stderr: PassThrough;
  exitCode: number | null;
  signalCode: string | null;
  kill: ReturnType<typeof vi.fn>;
  /** Ends the child like a process that exits by itself. */
  exit(code: number | null, signal?: string | null): void;
}

/** A child that stays alive until `exit`, or until it is killed (Electron exits 0 on SIGTERM). */
function fakeChild(exitCodeOnKill: number | null = 0): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.exitCode = null;
  child.signalCode = null;
  child.exit = (code, signal = null) => {
    child.exitCode = code;
    child.signalCode = signal;
    child.emit('exit', code, signal);
    child.emit('close', code, signal);
  };
  child.kill = vi.fn(() => {
    setImmediate(() => child.exit(exitCodeOnKill));
    return true;
  });
  return child;
}

function setup(
  overrides: {
    release?: (version: string) => unknown;
    /** The installed executable; undefined means the version needs a download. */
    execPath?: () => string | undefined;
    localBuild?: (id: string) => unknown;
    environmentVariables?: string[];
  } = {},
) {
  const windows = new Map<string, Record<string, unknown>>();
  windows.set('w', {
    fiddle: { name: 'Test', source: {}, fiddleRev: 0, versionRef: ref },
    layout: { consoleVisible: true, consoleHeight: 200 },
  });
  const changeListeners = new Set<
    (change: { store: 'window'; windowId: string }) => void
  >();
  const hub = {
    app: {
      settings: {
        packageManager: 'npm',
        packageAuthor: '',
        environmentVariables: overrides.environmentVariables ?? [],
        electronFlags: [],
        clearConsoleOnRun: false,
      },
    },
    getWindow: (id: string) => windows.get(id),
    updateWindow: (id: string, patch: Record<string, unknown>) => {
      windows.set(id, { ...windows.get(id), ...patch });
      for (const listener of changeListeners) listener({ store: 'window', windowId: id });
    },
    onChange: (listener: (change: { store: 'window'; windowId: string }) => void) => {
      changeListeners.add(listener);
      return () => changeListeners.delete(listener);
    },
  };
  const versions = {
    installer: new EventEmitter(),
    electronVersions: {},
    release: overrides.release ?? ((version: string) => ({ version, supported: true })),
    execPath: overrides.execPath ?? (() => '/fake/electron'),
    install: vi.fn<(version: string, signal?: AbortSignal) => Promise<string>>(),
    localBuild: overrides.localBuild ?? (() => undefined),
    label: (version: { version: string }) => version.version,
  };
  const sent: OutputLine[] = [];
  const runs = new RunService(hub as never, versions as never, (_id, lines) =>
    sent.push(...lines),
  );
  const state = () => (windows.get('w') as { run: RunState }).run;
  const texts = () => runs.output('w').map((line) => line.text);
  /** Every status the Run control went through, in order. */
  const statuses: string[] = [];
  hub.onChange(() => {
    const status = state()?.status;
    if (status && statuses.at(-1) !== status) statuses.push(status);
  });
  return { runs, state, texts, hub, versions, windows, statuses };
}

const runDirs: string[] = [];

beforeEach(() => {
  spawnElectron.mockReset();
  ensureTrusted.mockReset();
  ensureTrusted.mockResolvedValue({
    approved: true,
    allowScripts: false,
    fiddle: { files: { 'main.js': 'console.log(1)' }, modules: {}, version: ref },
  });
  setLayout.mockReset();
  modules.findPackageManager.mockReset().mockResolvedValue('/bin/npm');
  modules.installModules.mockReset().mockResolvedValue(undefined);
});

/** Approves a fiddle that depends on lodash, for the module install. */
function trustWithModules(allowScripts = false): void {
  ensureTrusted.mockResolvedValue({
    approved: true,
    allowScripts,
    fiddle: {
      files: { 'main.js': 'require("lodash")' },
      modules: { lodash: '*' },
      version: ref,
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of runDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

/** Makes `spawnElectron` return `child`, and remembers the run directory. */
function spawnReturns(child: FakeChild): void {
  spawnElectron.mockImplementation((options: { runDir: string }) => {
    runDirs.push(options.runDir);
    return child;
  });
}

// The run writes the app to a temp folder first, which can take a busy Windows runner over a second.
const running = (state: () => RunState) =>
  vi.waitFor(() => expect(state().status).toBe('running'), { timeout: 4000 });

describe('RunService.run', () => {
  it('runs a fiddle to a clean exit, and removes the run directory', async () => {
    const child = fakeChild();
    spawnReturns(child);
    const { runs, state, texts } = setup();
    const result = runs.run('w');
    await running(state);
    child.stdout.write('hello\n');
    child.exit(0);
    expect(await result).toMatchObject({ code: 0 });
    expect(state()).toMatchObject({ status: 'ready', result: 'success' });
    expect(texts()).toContain('hello');
    expect(texts().at(-1)).toContain('exitedCode');
    await runs.shutdown();
    expect(fs.existsSync(runDirs[0]!)).toBe(false);
  });

  it('ignores a run in a busy window', async () => {
    const child = fakeChild();
    spawnReturns(child);
    const { runs, state } = setup();
    const first = runs.run('w');
    await running(state);
    expect(await runs.run('w')).toEqual({ invalid: true });
    child.exit(0);
    await first;
  });

  it('refuses when the fiddle is not trusted, or the version is unknown', async () => {
    const { runs, state, texts } = setup();
    ensureTrusted.mockResolvedValueOnce({ approved: false });
    expect(await runs.run('w')).toEqual({ invalid: true });
    expect(state()).toMatchObject({ status: 'ready', result: 'invalid' });
    expect(texts()).toContain('untrusted');

    const unknown = setup({ release: () => undefined });
    expect(await unknown.runs.run('w')).toEqual({ invalid: true });
    expect(unknown.texts().at(-1)).toContain('versionUnknown');
    expect(spawnElectron).not.toHaveBeenCalled();
  });

  it('reports a spawn failure that arrives on the next tick, instead of hanging', async () => {
    spawnElectron.mockImplementation((options: { runDir: string }) => {
      runDirs.push(options.runDir);
      const child = fakeChild();
      process.nextTick(() => {
        child.emit('error', new Error('spawn ENOENT'));
        child.emit('close', -2, null);
      });
      return child;
    });
    const { runs, state, texts } = setup();
    expect(await runs.run('w')).toEqual({ spawnFailed: true });
    expect(state()).toMatchObject({ status: 'ready', result: 'failure' });
    expect(texts().some((text) => text.startsWith('spawnFailed'))).toBe(true);
  });

  it('reports a failure before Electron starts as itself, not as a failed start', async () => {
    ensureTrusted.mockRejectedValueOnce(new Error('ENOSPC: no space left on device'));
    const { runs, state, texts } = setup();
    expect(await runs.run('w')).toEqual({ spawnFailed: true });
    expect(state()).toMatchObject({ status: 'ready', result: 'failure' });
    expect(texts().at(-1)).toBe(
      'runFailed:{"message":"ENOSPC: no space left on device"}',
    );
  });

  it('records a stop as stopped, although Electron exits 0 on SIGTERM', async () => {
    const child = fakeChild(0);
    spawnReturns(child);
    const { runs, state } = setup();
    const result = runs.run('w');
    await running(state);
    runs.stop('w');
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(await result).toMatchObject({ code: 0, stopped: true });
    expect(state().status).toBe('ready');
    expect(state().result).toBeUndefined();
  });

  it('records a stop before Electron starts as stopped', async () => {
    let approve: (value: unknown) => void = () => {};
    ensureTrusted.mockReturnValueOnce(new Promise((resolve) => (approve = resolve)));
    const { runs, state } = setup();
    const result = runs.run('w');
    runs.stop('w');
    approve({
      approved: true,
      allowScripts: false,
      fiddle: { files: { 'main.js': '' }, modules: {}, version: ref },
    });
    expect(await result).toMatchObject({ signal: 'SIGTERM', stopped: true });
    expect(spawnElectron).not.toHaveBeenCalled();
    expect(state().status).toBe('ready');
    await runs.shutdown();
  });

  it('is ready as soon as the fiddle exits, before the run directory is gone', async () => {
    const child = fakeChild();
    spawnReturns(child);
    let finishDelete: () => void = () => {};
    const realRm = fsp.rm.bind(fsp);
    vi.spyOn(fsp, 'rm').mockImplementation(
      (target, options) =>
        new Promise<void>((resolve, reject) => {
          finishDelete = () => realRm(target, options).then(resolve, reject);
        }),
    );
    const { runs, state } = setup();
    const result = runs.run('w');
    await running(state);
    child.exit(0);
    await result;
    expect(state().status).toBe('ready');
    expect(runs.hasWork()).toBe(true);
    expect(fs.existsSync(runDirs[0]!)).toBe(true);
    finishDelete();
    await runs.shutdown();
    expect(runs.hasWork()).toBe(false);
    expect(fs.existsSync(runDirs[0]!)).toBe(false);
  });

  it('lists the version a run uses while it runs, an auto bisect step included', async () => {
    const child = fakeChild();
    spawnReturns(child);
    const { runs, state } = setup();
    expect(runs.versionsInUse()).toEqual([]);
    const other = { kind: 'release' as const, version: '29.0.0' };
    const result = runs.run('w', { versionRef: other });
    await running(state);
    expect(runs.versionsInUse()).toEqual([other]);
    child.exit(1);
    expect(await result).toMatchObject({ code: 1 });
    expect(state()).toMatchObject({ result: 'failure' });
    expect(runs.versionsInUse()).toEqual([]);
  });

  it('stops updating the errors once 50 are listed', async () => {
    const child = fakeChild();
    spawnReturns(child);
    const { runs, state, texts, hub } = setup();
    const result = runs.run('w');
    await running(state);
    const { appDir } = spawnElectron.mock.calls[0]![0] as { appDir: string };
    const source = pathToFileURL(path.join(appDir, 'main.js')).href;
    const error = `[1:0913/1.2:INFO:CONSOLE:4] "Uncaught Error: boom", source: ${source} (4)\n`;
    child.stderr.write(error.repeat(50));
    await vi.waitFor(() => expect(state().errors).toHaveLength(50));
    const updateWindow = vi.spyOn(hub, 'updateWindow');
    const before = texts().length;
    child.stderr.write(error);
    await vi.waitFor(() => expect(texts()).toHaveLength(before + 1));
    expect(updateWindow).not.toHaveBeenCalled();
    child.exit(0);
    await result;
  });

  it('shows the console when a run starts with it hidden or too small to read', async () => {
    const { runs, windows } = setup();
    runs.openConsole('w');
    expect(setLayout).not.toHaveBeenCalled();
    windows.set('w', {
      ...windows.get('w'),
      layout: { consoleVisible: false, consoleHeight: 200 },
    });
    runs.openConsole('w');
    expect(setLayout).toHaveBeenLastCalledWith('w', {
      consoleVisible: true,
      consoleHeight: 200,
    });
    windows.set('w', {
      ...windows.get('w'),
      layout: { consoleVisible: true, consoleHeight: 40 },
    });
    runs.openConsole('w');
    expect(setLayout).toHaveBeenLastCalledWith('w', {
      consoleVisible: true,
      consoleHeight: 160,
    });
  });

  it('lets Stop cancel a claimed operation until it is released', () => {
    const { runs } = setup();
    const claimed = runs.claim('w');
    runs.stop('w');
    expect(claimed.signal.aborted).toBe(true);
    const next = runs.claim('w');
    runs.release('w');
    runs.stop('w');
    expect(next.signal.aborted).toBe(false);
  });

  it('adds tool output one console line per non-blank line, and clears the backlog on request', () => {
    const { runs, texts, state } = setup();
    runs.logText('w', 'added 3 packages\r\n\n  audited 4 packages\n');
    expect(texts().slice(1)).toEqual(['added 3 packages', '  audited 4 packages']);
    runs.clear('w');
    expect(texts()).toEqual([]);
    expect(state().clearedSeq).toBeGreaterThan(0);
    runs.log('w', 'after');
    expect(texts()).toEqual(['after']);
  });

  it('starts a different fiddle with an empty console, but not a rename or an added file', () => {
    const { runs, texts, hub, state } = setup();
    const load = (fiddle: { name: string; fiddleRev: number }) =>
      hub.updateWindow('w', { fiddle: { ...fiddle, source: {}, versionRef: ref } });
    load({ name: 'Test', fiddleRev: 0 });
    runs.log('w', 'hello');
    runs.setState('w', {
      errors: [
        { process: 'main', name: 'Error', message: 'boom', file: 'main.js', line: 1 },
      ],
    });
    // A file added: same fiddle, new rev.
    load({ name: 'Test', fiddleRev: 1 });
    // Saved under another name: new identity, same rev.
    load({ name: 'Renamed', fiddleRev: 1 });
    expect(texts()).toEqual(['consoleReady:{"version":"30.0.0"}', 'hello']);
    expect(state().errors).toHaveLength(1);
    // Another fiddle opened: both change.
    load({ name: 'Other', fiddleRev: 2 });
    expect(texts()).toEqual(['consoleReady:{"version":"30.0.0"}']);
    expect(state()).toMatchObject({ errors: [], result: undefined });
  });

  describe('with modules', () => {
    it('installs them without scripts before Electron starts, then adds Electron to package.json', async () => {
      trustWithModules();
      modules.installModules.mockImplementation(async ({ onOutput }) => {
        onOutput('added 1 package\n');
      });
      const child = fakeChild();
      spawnReturns(child);
      const { runs, state, texts, statuses } = setup();
      const result = runs.run('w');
      await running(state);
      expect(modules.installModules).toHaveBeenCalledWith(
        expect.objectContaining({
          packageManager: 'npm',
          modules: { lodash: '*' },
          ignoreScripts: true,
        }),
      );
      expect(texts()).toContain('installingModulesNoScripts:{"pm":"npm"}');
      expect(texts()).toContain('added 1 package');
      expect(statuses).toEqual(['checking', 'installing', 'starting', 'running']);
      const { appDir } = spawnElectron.mock.calls[0]![0] as { appDir: string };
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'),
      ) as { devDependencies?: Record<string, string> };
      expect(packageJson.devDependencies?.electron).toBe(VERSION);
      child.exit(0);
      await result;
      await runs.shutdown();
    });

    it('refuses to run when the package manager is not installed, pointing at its download page', async () => {
      trustWithModules();
      modules.findPackageManager.mockResolvedValue(undefined);
      const { runs, texts, state } = setup();
      expect(await runs.run('w')).toEqual({ invalid: true });
      expect(texts().at(-1)).toBe(
        `pmMissing:${JSON.stringify({ pm: 'npm', url: 'https://docs.npmjs.com/downloading-and-installing-node-js-and-npm' })}`,
      );
      expect(state()).toMatchObject({ status: 'ready', result: 'invalid' });
      expect(spawnElectron).not.toHaveBeenCalled();
    });

    it('reports a failed install in the console and ends the run as a failure', async () => {
      trustWithModules(true);
      modules.installModules.mockRejectedValue(new Error('E404 lodash'));
      const { runs, texts, state } = setup();
      expect(await runs.run('w')).toEqual({ installFailed: true });
      expect(texts()).toContain('installingModules:{"pm":"npm"}');
      expect(texts().at(-1)).toBe('modulesFailed:{"message":"E404 lodash"}');
      expect(state()).toMatchObject({ status: 'ready', result: 'failure' });
      expect(spawnElectron).not.toHaveBeenCalled();
      await runs.shutdown();
    });
  });

  it('passes the user environment on, warning about entries it drops', async () => {
    const child = fakeChild();
    spawnReturns(child);
    const { runs, state, texts } = setup({
      environmentVariables: ['GOOD=1', 'no equals sign', 'NODE_OPTIONS=--inspect'],
    });
    const result = runs.run('w');
    await running(state);
    expect(texts()).toContain('envInvalid:{"entries":"no equals sign"}');
    expect(texts()).toContain('envBlocked:{"keys":"NODE_OPTIONS"}');
    const { env } = spawnElectron.mock.calls[0]![0] as { env: Record<string, string> };
    expect(env).toMatchObject({ GOOD: '1', ELECTRON_ENABLE_LOGGING: 'true' });
    expect(env).not.toHaveProperty('NODE_OPTIONS');
    child.exit(0);
    await result;
    await runs.shutdown();
  });

  it('tells the user where the inspector listens', async () => {
    const child = fakeChild();
    spawnReturns(child);
    const { runs, state, texts } = setup();
    const result = runs.run('w');
    await running(state);
    child.stderr.write('Debugger listening on ws://127.0.0.1:9229/8c5e0dc2\n');
    await vi.waitFor(() =>
      expect(texts()).toContain('inspector:{"port":"9229/8c5e0dc2"}'),
    );
    child.exit(0);
    await result;
    await runs.shutdown();
  });
});

describe('RunService.run with a local build or a missing version', () => {
  const local: VersionRefValue = { kind: 'local', id: 'b1' };

  it('runs a local build from its folder, and refuses one whose binary is gone', async () => {
    const child = fakeChild();
    spawnReturns(child);
    const buildPath = path.join('builds', 'testing');
    const available = setup({
      localBuild: () => ({
        id: 'b1',
        name: 'My build',
        path: buildPath,
        available: true,
      }),
    });
    const result = available.runs.run('w', { versionRef: local });
    await running(available.state);
    expect(spawnElectron.mock.calls[0]![0]).toMatchObject({
      exec: Installer.getExecPath(buildPath),
    });
    expect(available.state().version).toBe('My build');
    expect(available.texts()).toContain('started:{"version":"My build","name":"test"}');
    child.exit(0);
    await result;
    await available.runs.shutdown();

    const gone = setup({
      localBuild: () => ({
        id: 'b1',
        name: 'My build',
        path: buildPath,
        available: false,
      }),
    });
    expect(await gone.runs.run('w', { versionRef: local })).toEqual({ invalid: true });
    expect(gone.texts().at(-1)).toBe('localBuildMissing:{"name":"My build"}');
    expect(spawnElectron).toHaveBeenCalledOnce();
  });

  it('refuses a release that has no build for this platform', async () => {
    const { runs, texts } = setup({
      release: (version) => ({ version, supported: false }),
    });
    expect(await runs.run('w')).toEqual({ invalid: true });
    expect(texts().at(-1)).toBe('versionUnavailable:{"version":"30.0.0"}');
  });

  it('downloads a missing version first, showing the download and unzip as they happen', async () => {
    const child = fakeChild();
    spawnReturns(child);
    const { runs, state, texts, versions, statuses } = setup({
      execPath: () => undefined,
    });
    versions.install.mockImplementation(async (version) => {
      versions.installer.emit('state-changed', { version, state: 'downloading' });
      versions.installer.emit('state-changed', { version: '1.0.0', state: 'installing' });
      versions.installer.emit('state-changed', { version, state: 'installing' });
      return '/downloaded/electron';
    });
    const result = runs.run('w');
    await running(state);
    expect(versions.install).toHaveBeenCalledWith(VERSION, expect.any(AbortSignal));
    expect(versions.installer.listenerCount('state-changed')).toBe(0);
    expect(statuses).toEqual([
      'checking',
      'downloading',
      'unzipping',
      'checking',
      'starting',
      'running',
    ]);
    expect(texts()).toContain('downloading:{"version":"30.0.0"}');
    expect(spawnElectron.mock.calls[0]![0]).toMatchObject({
      exec: '/downloaded/electron',
    });
    child.exit(0);
    await result;
    await runs.shutdown();
  });

  it('refuses the run when the download fails, with the reason', async () => {
    const { runs, texts, versions, state } = setup({ execPath: () => undefined });
    versions.install.mockRejectedValue(new Error('HTTP 404'));
    expect(await runs.run('w')).toEqual({ invalid: true });
    expect(texts().at(-1)).toBe(
      'downloadFailed:{"version":"30.0.0","message":"HTTP 404"}',
    );
    expect(state()).toMatchObject({ status: 'ready', result: 'invalid' });
    expect(versions.installer.listenerCount('state-changed')).toBe(0);
  });

  it('records a stop during the download as stopped, not as a failed download', async () => {
    const { runs, texts, versions, state } = setup({ execPath: () => undefined });
    versions.install.mockImplementation(
      (_version, signal) =>
        new Promise<string>((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const result = runs.run('w');
    await vi.waitFor(() => expect(state().status).toBe('downloading'));
    runs.stop('w');
    expect(await result).toEqual({ signal: 'SIGTERM', stopped: true });
    expect(texts().some((text) => text.startsWith('downloadFailed'))).toBe(false);
    expect(spawnElectron).not.toHaveBeenCalled();
  });
});

describe('RunService.shutdown and stopAndWait', () => {
  it('stops a running fiddle and waits for its run directory to be removed', async () => {
    const child = fakeChild();
    spawnReturns(child);
    const { runs, state } = setup();
    const result = runs.run('w');
    await running(state);
    expect(runs.hasWork()).toBe(true);
    await runs.shutdown();
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(runs.hasWork()).toBe(false);
    expect(fs.existsSync(runDirs[0]!)).toBe(false);
    await result;
  });

  it('gives up after the timeout', async () => {
    const child = fakeChild();
    child.kill = vi.fn(() => true);
    spawnReturns(child);
    const { runs, state } = setup();
    const result = runs.run('w');
    await running(state);
    await runs.shutdown(20);
    expect(runs.hasWork()).toBe(true);
    child.exit(0);
    await result;
    await runs.shutdown();
  });

  it('resolves stopAndWait when the window closes before the run has ended', async () => {
    const child = fakeChild();
    child.kill = vi.fn(() => true);
    spawnReturns(child);
    const { runs, state } = setup();
    const result = runs.run('w');
    await running(state);
    const stopped = runs.stopAndWait('w');
    runs.disposeWindow('w');
    await stopped;
    child.exit(0);
    await result;
    await runs.shutdown();
  });

  it('resolves stopAndWait once the window is ready again', async () => {
    const child = fakeChild();
    spawnReturns(child);
    const { runs, state } = setup();
    const result = runs.run('w');
    await running(state);
    await runs.stopAndWait('w');
    expect(state().status).toBe('ready');
    await result;
    await runs.stopAndWait('w');
    await runs.shutdown();
  });
});

describe('installRunCleanupOnExit', () => {
  it('holds every quit until the shutdown has ended', async () => {
    let finish: () => void = () => {};
    const runs = {
      hasWork: () => true,
      shutdown: vi.fn(() => new Promise<void>((resolve) => (finish = resolve))),
    };
    installRunCleanupOnExit(runs as never);
    const calls = vi.mocked(app.on).mock.calls as unknown as [
      string,
      (e: unknown) => void,
    ][];
    const onWillQuit = calls.find(([name]) => name === 'will-quit')![1];
    const willQuit = () => {
      const event = { preventDefault: vi.fn() };
      onWillQuit(event);
      return event.preventDefault;
    };
    expect(willQuit()).toHaveBeenCalled();
    // Another handler's `app.quit()` comes while the runs are still stopping.
    expect(willQuit()).toHaveBeenCalled();
    expect(runs.shutdown).toHaveBeenCalledOnce();
    expect(app.quit).not.toHaveBeenCalled();

    finish();
    await vi.waitFor(() => expect(app.quit).toHaveBeenCalledOnce());
    expect(willQuit()).not.toHaveBeenCalled();
  });
});
