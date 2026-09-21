/** The run lifecycle, with `spawnElectron` returning a fake child. */
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OutputLine, RunState } from '../../shared/stores';

const spawnElectron = vi.fn();
const ensureTrusted = vi.fn();

vi.mock('electron', () => ({ app: { on: vi.fn(), quit: vi.fn(), isPackaged: false } }));
vi.mock('../documents/service', () => ({
  ensureTrusted: (...args: unknown[]) => ensureTrusted(...args),
  setLayout: vi.fn(),
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

function setup(overrides: { release?: (version: string) => unknown } = {}) {
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
        environmentVariables: [],
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
    installer: {},
    electronVersions: {},
    release: overrides.release ?? ((version: string) => ({ version, supported: true })),
    execPath: () => '/fake/electron',
    localBuild: () => undefined,
    label: (version: { version: string }) => version.version,
  };
  const sent: OutputLine[] = [];
  const runs = new RunService(hub as never, versions as never, (_id, lines) =>
    sent.push(...lines),
  );
  const state = () => (windows.get('w') as { run: RunState }).run;
  const texts = () => runs.output('w').map((line) => line.text);
  return { runs, state, texts, hub };
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
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of runDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

/** Makes `spawnElectron` return `child`, and remembers the run directory. */
function spawnReturns(child: FakeChild): void {
  spawnElectron.mockImplementation(async (options: { runDir: string }) => {
    runDirs.push(options.runDir);
    return child;
  });
}

const running = (state: () => RunState) =>
  vi.waitFor(() => expect(state().status).toBe('running'));

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
    spawnElectron.mockImplementation(async (options: { runDir: string }) => {
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
