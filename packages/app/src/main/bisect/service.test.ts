/** The bisect lifecycle: how each run ends the bisect or gives a verdict, and Stop. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorCode } from '../../shared/errors';
import type { BisectState } from '../../shared/stores';
import type { RunOutcome } from '../run/logic';

const electron = vi.hoisted(() => ({ app: {}, shell: { openExternal: vi.fn() } }));
const confirm = vi.hoisted(() => vi.fn<() => Promise<boolean>>());
vi.mock('electron', () => electron);
vi.mock('../dialogs', () => ({ confirm }));
vi.mock('../documents/service', () => ({
  ensureTrusted: vi.fn(async () => ({ approved: true })),
  setFiddleVersion: vi.fn(async () => 1),
}));
vi.mock('../i18n', () => ({
  tm: () => (key: string, options?: Record<string, unknown>) =>
    options ? `${key}:${JSON.stringify(options)}` : key,
}));
vi.mock('../log', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { BisectService } = await import('./service');

const VERSIONS = ['1.0.0', '2.0.0', '3.0.0', '4.0.0', '5.0.0'];

interface Step {
  version: string;
  resolve(outcome: RunOutcome): void;
}

function setup() {
  let bisect: BisectState | null = null;
  const logs: string[] = [];
  const steps: Step[] = [];
  const waiters: Array<() => void> = [];
  const runs = {
    state: () => ({ bisect }),
    setState: (_id: string, patch: { bisect?: BisectState | null }) => {
      if ('bisect' in patch) bisect = patch.bisect ?? null;
    },
    log: (_id: string, text: string) => logs.push(text),
    stop: vi.fn(),
    stopAndWait: vi.fn(async () => {}),
    /** Each run waits for the test to say how it ended. */
    run: vi.fn(
      (_id: string, options: { versionRef: { version: string } }) =>
        new Promise<RunOutcome>((resolve) => {
          steps.push({ version: options.versionRef.version, resolve });
          waiters.splice(0).forEach((wake) => wake());
        }),
    ),
  };
  const versions = {
    releases: () =>
      [...VERSIONS].reverse().map((version) => ({
        version,
        date: '',
        node: '',
        obsolete: false,
        supported: true,
      })),
    isInstalled: vi.fn((_version: string) => true),
    install: vi.fn(async (_version: string) => ''),
  };
  const hub = {
    app: {
      settings: { channels: ['stable'], showObsolete: true, showNotDownloaded: true },
    },
  };
  const typesChanged = vi.fn();
  const service = new BisectService(
    hub as never,
    runs as never,
    versions as never,
    typesChanged,
  );
  /** The next run to start, once it has. */
  const nextRun = async (): Promise<Step> => {
    while (steps.length === 0)
      await new Promise<void>((resolve) => waiters.push(resolve));
    return steps.shift()!;
  };
  /** Answers each run with `outcomeFor(version)` until the bisect has ended. */
  const answerRuns = async (outcomeFor: (version: string) => RunOutcome) => {
    do {
      const step = await nextRun();
      step.resolve(outcomeFor(step.version));
      await new Promise((resolve) => setTimeout(resolve, 0));
    } while (bisect !== null && !bisect.result);
  };
  return {
    service,
    runs,
    versions,
    logs,
    nextRun,
    answerRuns,
    typesChanged,
    bisect: () => bisect,
  };
}

const exit = (code: number): RunOutcome => ({ code, signal: null });

let ctx: ReturnType<typeof setup>;
beforeEach(() => {
  ctx = setup();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('BisectService.start', () => {
  it('refuses a good version that is not older than the bad one, and a range of fewer than two versions', async () => {
    await expect(ctx.service.start('w', '5.0.0', '1.0.0', true)).rejects.toMatchObject({
      code: ErrorCode.invalidArgument,
      message: 'bisectGoodNotOlder',
    });
    await expect(ctx.service.start('w', '1.0.0', '1.5.0', false)).rejects.toMatchObject({
      code: ErrorCode.invalidArgument,
      message: 'bisectTooFew',
    });
    expect(ctx.bisect()).toBeNull();
    expect(ctx.runs.run).not.toHaveBeenCalled();
  });

  it('does not start an auto bisect on a fiddle the user will not trust', async () => {
    const documents = await import('../documents/service');
    vi.mocked(documents.ensureTrusted).mockResolvedValueOnce({
      approved: false,
    } as never);
    await ctx.service.start('w', '1.0.0', '5.0.0', true);
    expect(ctx.logs).toEqual(['untrusted']);
    expect(ctx.bisect()).toBeNull();
    expect(ctx.runs.run).not.toHaveBeenCalled();
  });
});

describe('BisectService (auto)', () => {
  it('finds the first bad version from exit codes', async () => {
    await ctx.service.start('w', '1.0.0', '5.0.0', true);
    await ctx.answerRuns((version) => exit(version >= '4.0.0' ? 1 : 0));
    expect(ctx.bisect()?.result).toEqual({ good: '3.0.0', bad: '4.0.0' });
    expect(ctx.logs.at(-1)).toContain('bisectDone');
    expect(ctx.runs.run).toHaveBeenCalledWith(
      'w',
      expect.objectContaining({
        versionRef: { kind: 'release', version: '1.0.0' },
        trustOperation: 'auto-bisect',
      }),
    );
  });

  it('stops when an end of the range gives the wrong result', async () => {
    await ctx.service.start('w', '1.0.0', '5.0.0', true);
    await ctx.answerRuns(() => exit(1));
    expect(ctx.bisect()).toBeNull();
    expect(ctx.logs.some((line) => line.startsWith('bisectVerifyFailed'))).toBe(true);
  });

  it('ends the bisect when a run says nothing about the version, instead of counting it as bad', async () => {
    await ctx.service.start('w', '1.0.0', '5.0.0', true);
    const first = await ctx.nextRun();
    first.resolve({ installFailed: true });
    await vi.waitFor(() => expect(ctx.bisect()).toBeNull());
    expect(ctx.logs.some((line) => line === 'bisectInvalid')).toBe(true);
    expect(ctx.logs.some((line) => line.startsWith('bisectVerdictBad'))).toBe(false);
  });

  it('tells the user when a run throws, instead of letting the bisect vanish', async () => {
    ctx.runs.run.mockRejectedValueOnce(new Error('spawn failed'));
    await ctx.service.start('w', '1.0.0', '5.0.0', true);
    await vi.waitFor(() => expect(ctx.bisect()).toBeNull());
    expect(ctx.logs).toContain('bisectInvalid');
  });

  it('ends the bisect quietly when the run is stopped from the Run control', async () => {
    await ctx.service.start('w', '1.0.0', '5.0.0', true);
    const first = await ctx.nextRun();
    // Electron exits 0 on SIGTERM, which must not count as a good version.
    first.resolve({ code: 0, signal: null, stopped: true });
    await vi.waitFor(() => expect(ctx.bisect()).toBeNull());
    expect(ctx.logs.some((line) => line.startsWith('bisectVerdict'))).toBe(false);
    expect(ctx.logs).not.toContain('bisectInvalid');
    expect(ctx.runs.run).toHaveBeenCalledTimes(1);
  });

  it('leaves a new bisect alone when the one it replaced finishes late', async () => {
    vi.useFakeTimers();
    await ctx.service.start('w', '1.0.0', '5.0.0', true);
    const old = await ctx.nextRun();
    ctx.service.stop('w');
    expect(ctx.bisect()).toBeNull();

    await ctx.service.start('w', '2.0.0', '5.0.0', true);
    const replacement = await ctx.nextRun();
    expect(ctx.bisect()).not.toBeNull();

    old.resolve({ code: 0, signal: null, stopped: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(ctx.bisect()).toMatchObject({ auto: true, result: null });
    replacement.resolve({ code: 0, signal: null, stopped: true });
    await vi.waitFor(() => expect(ctx.bisect()).toBeNull());
  });
});

describe('BisectService (manual)', () => {
  it('steps through versions and reports the result, telling the editor about each version', async () => {
    expect(ctx.service.isActive('w')).toBe(false);
    await ctx.service.start('w', '1.0.0', '5.0.0', false);
    expect(ctx.bisect()).toMatchObject({ auto: false, current: '3.0.0' });
    expect(ctx.service.isActive('w')).toBe(true);
    // Nothing to compare yet.
    await ctx.service.openCompare('w');
    expect(confirm).not.toHaveBeenCalled();
    expect(ctx.typesChanged).toHaveBeenCalledWith('w');
    await ctx.service.mark('w', 'good');
    await ctx.service.mark('w', 'bad');
    expect(ctx.bisect()?.result).toEqual({ good: '3.0.0', bad: '4.0.0' });
    expect(ctx.service.isActive('w')).toBe(false);

    // The comparison opens only when the user agrees, after seeing its URL.
    const url = 'https://github.com/electron/electron/compare/v3.0.0...v4.0.0';
    confirm.mockResolvedValueOnce(false);
    await ctx.service.openCompare('w');
    expect(confirm).toHaveBeenCalledWith('w', expect.objectContaining({ detail: url }));
    expect(electron.shell.openExternal).not.toHaveBeenCalled();
    confirm.mockResolvedValueOnce(true);
    await ctx.service.openCompare('w');
    expect(electron.shell.openExternal).toHaveBeenCalledWith(url);
  });

  it('starts downloading a step the user does not have yet, so Run is quick', async () => {
    ctx.versions.isInstalled.mockImplementation((version) => version !== '4.0.0');
    await ctx.service.start('w', '1.0.0', '5.0.0', false);
    expect(ctx.versions.install).not.toHaveBeenCalled();
    await ctx.service.mark('w', 'good');
    expect(ctx.bisect()).toMatchObject({ current: '4.0.0' });
    expect(ctx.versions.install).toHaveBeenCalledWith('4.0.0');
  });

  it('ignores a verdict while the next version is still loading', async () => {
    const documents = await import('../documents/service');
    await ctx.service.start('w', '1.0.0', '5.0.0', false);
    let finish: () => void = () => {};
    vi.mocked(documents.setFiddleVersion).mockImplementationOnce(
      () => new Promise((resolve) => (finish = () => resolve(1))),
    );
    const first = ctx.service.mark('w', 'good');
    // A double-click: 4.0.0 is not on screen yet, so this is not its verdict.
    await ctx.service.mark('w', 'good');
    finish();
    await first;
    expect(ctx.bisect()).toMatchObject({ current: '4.0.0', result: null });
  });

  it('does not bring a stopped bisect back', async () => {
    const documents = await import('../documents/service');
    let finish: () => void = () => {};
    vi.mocked(documents.setFiddleVersion).mockImplementationOnce(
      () => new Promise((resolve) => (finish = () => resolve(1))),
    );
    const started = ctx.service.start('w', '1.0.0', '5.0.0', false);
    await vi.waitFor(() => expect(ctx.runs.stop).toHaveBeenCalled());
    ctx.service.stop('w');
    finish();
    await started;
    expect(ctx.bisect()).toBeNull();
  });
});
