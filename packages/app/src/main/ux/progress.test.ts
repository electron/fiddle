import { describe, expect, it } from 'vitest';

import type { RunState, VersionsState } from '../../shared/stores';
import {
  downloadsFinished,
  finishedWindowOperations,
  LONG_RUN_MS,
  runStarted,
  taskbarProgress,
} from './progress';

const run = (patch: Partial<RunState> = {}): RunState => ({
  status: 'ready',
  task: 'run',
  errors: [],
  clearedSeq: 0,
  bisect: null,
  ...patch,
});

const versions = (patch: Partial<VersionsState> = {}): VersionsState => ({
  releasesRev: 0,
  installs: {},
  localBuilds: [],
  downloadingAll: false,
  arch: 'x64',
  ...patch,
});

const bisect = (current: string | null, result: { good: string; bad: string } | null = null) => ({
  good: '1.0.0',
  bad: '2.0.0',
  auto: true,
  current,
  result,
});

describe('taskbarProgress', () => {
  it('shows nothing when idle', () => {
    expect(taskbarProgress(versions(), run())).toEqual({ mode: 'none' });
    expect(taskbarProgress(undefined, undefined)).toEqual({ mode: 'none' });
  });

  it("prefers the window's own download", () => {
    const downloading = versions({ installs: { '1.0.0': { state: 'downloading', percent: 10 } } });
    expect(taskbarProgress(downloading, run({ status: 'downloading', percent: 42 }))).toEqual({
      mode: 'normal',
      progress: 0.42,
    });
  });

  it('is indeterminate while packaging or auto-bisecting', () => {
    expect(taskbarProgress(versions(), run({ task: 'make', status: 'running' }))).toEqual({
      mode: 'indeterminate',
    });
    expect(taskbarProgress(versions(), run({ bisect: bisect('1.5.0') }))).toEqual({
      mode: 'indeterminate',
    });
  });

  it('averages app downloads', () => {
    const state = versions({
      installs: {
        '1.0.0': { state: 'downloading', percent: 20 },
        '2.0.0': { state: 'downloading', percent: 60 },
        '3.0.0': { state: 'installed' },
      },
    });
    expect(taskbarProgress(state, run())).toEqual({ mode: 'normal', progress: 0.4 });
  });
});

describe('finishedWindowOperations', () => {
  it('reports a finished auto-bisect', () => {
    const prev = run({ bisect: bisect('1.5.0') });
    const next = run({ bisect: bisect(null, { good: '1.4.0', bad: '1.5.0' }) });
    expect(finishedWindowOperations(prev, next, undefined, 0)).toEqual([{ kind: 'bisect', ok: true }]);
    expect(finishedWindowOperations(prev, run(), undefined, 0)).toEqual([{ kind: 'bisect', ok: false }]);
  });

  it('ignores manual bisects', () => {
    const prev = run({ bisect: { ...bisect('1.5.0'), auto: false } });
    expect(finishedWindowOperations(prev, run(), undefined, 0)).toEqual([]);
  });

  it('reports package and make with their result', () => {
    const prev = run({ task: 'package', status: 'running' });
    expect(finishedWindowOperations(prev, run({ task: 'package', result: 'success' }), undefined, 0)).toEqual([
      { kind: 'package', ok: true },
    ]);
    expect(finishedWindowOperations(prev, run({ task: 'package', result: 'failure' }), undefined, 0)).toEqual([
      { kind: 'package', ok: false },
    ]);
  });

  it('reports only runs longer than 10 seconds', () => {
    const prev = run({ status: 'running' });
    expect(finishedWindowOperations(prev, run(), 0, LONG_RUN_MS - 1)).toEqual([]);
    expect(finishedWindowOperations(prev, run({ result: 'failure' }), 0, LONG_RUN_MS)).toEqual([
      { kind: 'run', ok: false },
    ]);
    expect(finishedWindowOperations(prev, run({ result: 'success' }), 0, LONG_RUN_MS)).toEqual([
      { kind: 'run', ok: true },
    ]);
  });

  it('reports nothing without a previous state', () => {
    expect(finishedWindowOperations(undefined, run(), 0, LONG_RUN_MS)).toEqual([]);
  });
});

describe('runStarted', () => {
  it('is true only on the transition into running', () => {
    expect(runStarted(run({ status: 'starting' }), run({ status: 'running' }))).toBe(true);
    expect(runStarted(run({ status: 'running' }), run({ status: 'running' }))).toBe(false);
    expect(runStarted(run(), run({ task: 'package', status: 'running' }))).toBe(false);
  });
});

describe('downloadsFinished', () => {
  it('reports the end of download all', () => {
    expect(downloadsFinished(versions({ downloadingAll: true }), versions())).toEqual({
      kind: 'downloads',
      ok: true,
    });
    expect(downloadsFinished(versions(), versions())).toBeUndefined();
    expect(downloadsFinished(versions({ downloadingAll: true }), versions({ downloadingAll: true }))).toBeUndefined();
  });
});
