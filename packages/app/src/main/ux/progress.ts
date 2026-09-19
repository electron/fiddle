import type { RunState, VersionsState } from '../../shared/stores';

type TaskbarProgress =
  { mode: 'none' } | { mode: 'indeterminate' } | { mode: 'normal'; progress: number };

export type OperationKind = 'bisect' | 'package' | 'downloads' | 'run';

export interface FinishedOperation {
  kind: OperationKind;
  ok: boolean;
}

/** A run has to take this long before its end is worth a notification. */
export const LONG_RUN_MS = 10_000;

const isAutoBisecting = (run: RunState | undefined) =>
  !!run?.bisect?.auto && run.bisect.current !== null;

const isPackaging = (run: RunState | undefined) =>
  !!run && run.task !== 'run' && run.status !== 'ready';

/**
 * The window's own operation wins (downloading its version, package or make,
 * auto-bisect); otherwise the app's version downloads.
 */
export function taskbarProgress(
  versions: VersionsState | undefined,
  run: RunState | undefined,
): TaskbarProgress {
  if (run?.status === 'downloading') {
    const percent = run.version ? versions?.installs[run.version]?.percent : undefined;
    return percent === undefined
      ? { mode: 'indeterminate' }
      : { mode: 'normal', progress: percent / 100 };
  }
  if (isPackaging(run) || isAutoBisecting(run)) return { mode: 'indeterminate' };

  const installs = Object.values(versions?.installs ?? {});
  const downloading = installs.filter((install) => install.state === 'downloading');
  if (downloading.length > 0) {
    const total = downloading.reduce((sum, install) => sum + (install.percent ?? 0), 0);
    return { mode: 'normal', progress: total / downloading.length / 100 };
  }
  if (
    installs.some((install) => install.state === 'installing') ||
    versions?.downloadingAll
  ) {
    return { mode: 'indeterminate' };
  }
  return { mode: 'none' };
}

/**
 * Operations in one window that ended between two `Window.run` values.
 * `runStartedAt` is when the current run started (see `runStarted`).
 */
export function finishedWindowOperations(
  prev: RunState | undefined,
  next: RunState | undefined,
  runStartedAt: number | undefined,
  now: number,
): FinishedOperation[] {
  if (!prev) return [];
  const finished: FinishedOperation[] = [];

  if (isAutoBisecting(prev) && !isAutoBisecting(next)) {
    finished.push({ kind: 'bisect', ok: !!next?.bisect?.result });
  }
  if (isPackaging(prev) && next?.status === 'ready') {
    finished.push({ kind: 'package', ok: next.result === 'success' });
  }
  if (
    prev.task === 'run' &&
    prev.status === 'running' &&
    next?.status !== 'running' &&
    runStartedAt !== undefined &&
    now - runStartedAt >= LONG_RUN_MS
  ) {
    finished.push({ kind: 'run', ok: next?.result !== 'failure' });
  }
  return finished;
}

/** True when the fiddle itself has just started running. */
export function runStarted(
  prev: RunState | undefined,
  next: RunState | undefined,
): boolean {
  return next?.task === 'run' && next.status === 'running' && prev?.status !== 'running';
}

/** "Download all" just ended. */
export function downloadsFinished(
  prev: VersionsState | undefined,
  next: VersionsState | undefined,
): FinishedOperation | undefined {
  if (!prev?.downloadingAll || next?.downloadingAll) return undefined;
  return { kind: 'downloads', ok: !next?.downloadAllFailed };
}
