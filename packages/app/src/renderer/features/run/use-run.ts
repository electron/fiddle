/** Run state, console lines and the release list, from main's stores and methods. */
import { useEffect, useMemo, useState } from 'react';

import { runApi, useAppStore, versionsApi } from '../../../ipc/renderer';
import type { AppState, OutputLine, ReleaseRow, RunState, VersionRefValue } from '../../../shared/stores';
import { useWindowState } from '../../shell/window-state';

export const IDLE_RUN: RunState = { status: 'ready', task: 'run', errors: [], clearedSeq: 0, bisect: null };
const CONSOLE_LIMIT = 1000;

export function useAppState(): AppState | undefined {
  const app = useAppStore();
  return app.state === 'ready' ? app.result : undefined;
}

export function useRunState(): RunState {
  return useWindowState()?.run ?? IDLE_RUN;
}

/** ⌘R on macOS, Ctrl+R elsewhere. */
export function useRunKbd(): string {
  return useAppState()?.platform === 'darwin' ? '⌘R' : 'Ctrl+R';
}

/** A version reference as shown to people: the release number or the local build's name. */
export function versionLabel(ref: VersionRefValue | undefined, app: AppState | undefined): string | undefined {
  if (!ref) return undefined;
  if (ref.kind === 'release') return ref.version;
  return app?.versions?.localBuilds.find((b) => b.id === ref.id)?.name;
}

/**
 * Console lines: the backlog from `Run.GetOutput`, then `Run.Output` batches.
 * Lines already seen, and lines at or below `Window.run.clearedSeq`, are dropped.
 */
export function useConsoleLines(): OutputLine[] {
  const [lines, setLines] = useState<OutputLine[]>([]);
  const clearedSeq = useRunState().clearedSeq;

  useEffect(() => {
    let last = 0;
    let live = true;
    let pending: OutputLine[] | null = [];
    const add = (batch: readonly OutputLine[]) => {
      const fresh = batch.filter((line) => line.seq > last);
      if (!live || fresh.length === 0) return;
      last = fresh[fresh.length - 1]!.seq;
      setLines((prev) => {
        const next = prev.concat(fresh);
        return next.length > CONSOLE_LIMIT ? next.slice(next.length - CONSOLE_LIMIT) : next;
      });
    };
    let unsubscribe: (() => void) | undefined;
    try {
      // Batches that arrive before the backlog wait for it, so nothing is lost.
      unsubscribe = runApi.onOutput((batch) => (pending ? pending.push(...batch) : add(batch)));
      runApi.GetOutput().then(
        (backlog) => {
          add(backlog);
          const early = pending ?? [];
          pending = null;
          add(early);
        },
        (error: unknown) => console.error('[fiddle] loading console output failed', error),
      );
    } catch (error) {
      console.error('[fiddle] console unavailable', error);
    }
    return () => {
      live = false;
      unsubscribe?.();
    };
  }, []);

  return useMemo(() => lines.filter((line) => line.seq > clearedSeq), [lines, clearedSeq]);
}

let releasesCache: { rev: number; rows: Promise<ReleaseRow[]> } | undefined;

/** Every release, newest first. Fetched again when `App.versions.releasesRev` changes. */
export function useReleases(): ReleaseRow[] {
  const rev = useAppState()?.versions?.releasesRev ?? 0;
  const [rows, setRows] = useState<ReleaseRow[]>([]);
  useEffect(() => {
    if (rev === 0) return;
    let live = true;
    if (releasesCache?.rev !== rev) {
      const request = versionsApi.GetReleases();
      releasesCache = { rev, rows: request };
      request.catch(() => {
        if (releasesCache?.rows === request) releasesCache = undefined;
      });
    }
    releasesCache.rows.then(
      (next) => live && setRows(next),
      (error: unknown) => console.error('[fiddle] loading releases failed', error),
    );
    return () => {
      live = false;
    };
  }, [rev]);
  return rows;
}
