import { useEffect, useMemo, useState } from 'react';

import { runApi, versionsApi } from '../../../ipc/renderer';
import type {
  AppState,
  OutputLine,
  ReleaseRow,
  RunState,
  VersionRefValue,
} from '../../../shared/stores';
import { useAppState, useWindowState } from '../../state';
import { toastError } from '../../toast-error';

/** Label keys of the states that show plain text, in the status bar and the busy Run button. */
export const STATUS_LABEL = {
  ready: 'ready',
  checking: 'checking',
  unzipping: 'unzipping',
  installing: 'installingModules',
  starting: 'starting',
} as const satisfies Partial<Record<RunState['status'], string>>;

export const IDLE_RUN: RunState = {
  status: 'ready',
  task: 'run',
  errors: [],
  clearedSeq: 0,
  bisect: null,
};
const CONSOLE_LIMIT = 1000;
// A fiddle that colours its output (FORCE_COLOR, or a library) writes escape sequences the console doesn't interpret.
// eslint-disable-next-line no-control-regex
const ESCAPE_SEQUENCE = /\u001b\[[0-?]*[ -/]*[@-~]/g;

const withoutEscapes = (line: OutputLine): OutputLine => {
  const text = line.text.replace(ESCAPE_SEQUENCE, '');
  return text === line.text ? line : { ...line, text };
};

export function useRunState(): RunState {
  return useWindowState()?.run ?? IDLE_RUN;
}

/** A version reference as shown to people: the release number or the local build's name. */
export function versionLabel(
  ref: VersionRefValue | undefined,
  app: AppState | undefined,
): string | undefined {
  if (!ref) return undefined;
  if (ref.kind === 'release') return ref.version;
  return app?.versions?.localBuilds.find((b) => b.id === ref.id)?.name;
}

/** The backlog from `Run.GetOutput`, then `Run.Output` batches, without lines already seen or at or below `clearedSeq`. */
export function useConsoleLines(): OutputLine[] {
  const [lines, setLines] = useState<OutputLine[]>([]);
  const clearedSeq = useRunState().clearedSeq;

  useEffect(() => {
    let last = 0;
    let live = true;
    let pending: OutputLine[] | null = [];
    const add = (batch: readonly OutputLine[]) => {
      const fresh = batch.filter((line) => line.seq > last).map(withoutEscapes);
      if (!live || fresh.length === 0) return;
      last = fresh[fresh.length - 1]!.seq;
      setLines((prev) => {
        const next = prev.concat(fresh);
        return next.length > CONSOLE_LIMIT
          ? next.slice(next.length - CONSOLE_LIMIT)
          : next;
      });
    };
    // Batches that arrive before the backlog wait for it, so nothing is lost.
    const flush = () => {
      const early = pending ?? [];
      pending = null;
      add(early);
    };
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = runApi.onOutput((batch) =>
        pending ? pending.push(...batch) : add(batch),
      );
      runApi.GetOutput().then(
        (backlog) => {
          add(backlog);
          flush();
        },
        (error: unknown) => {
          flush();
          if (live) toastError(error);
        },
      );
    } catch (error) {
      console.error('[fiddle] console unavailable', error);
    }
    return () => {
      live = false;
      unsubscribe?.();
    };
  }, []);

  return useMemo(
    () => lines.filter((line) => line.seq > clearedSeq),
    [lines, clearedSeq],
  );
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
