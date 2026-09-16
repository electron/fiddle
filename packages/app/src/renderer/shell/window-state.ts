/**
 * The Window store with optimistic changes replayed on top (REQUIREMENTS §3,
 * "Optimistic updates"). A change shows at once; it's dropped once the store
 * reaches the `rev` the change method returned, or when main rejects it (the
 * error is shown as a toast).
 */
import { useSyncExternalStore } from 'react';

import { moveName } from '../../fiddle/files';
import { followActiveFile } from '../../shared/panes';
import type { WindowLayout, WindowState } from '../../shared/stores';
import { documentsApi } from '../../ipc/renderer';
import { showToast } from '../../ui';

type Apply = (state: WindowState) => WindowState;

interface Pending {
  apply: Apply;
  /** The rev that includes the change, once main has answered. */
  rev: number | null;
}

let pending: readonly Pending[] = [];
const listeners = new Set<() => void>();

function setPending(next: readonly Pending[]) {
  pending = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Shows `apply` at once, then asks main with `call`. */
export function change(apply: Apply, call: () => Promise<number>, errorTitle: string): Promise<void> {
  const entry: Pending = { apply, rev: null };
  setPending([...pending, entry]);
  return call().then(
    (rev) => {
      entry.rev = rev;
      setPending([...pending]);
    },
    (error: unknown) => {
      setPending(pending.filter((p) => p !== entry));
      showToast({ tone: 'error', title: errorTitle, description: error instanceof Error ? error.message : String(error) });
    },
  );
}

/**
 * `base` (the Window store) with pending changes on top, or null before it's
 * ready. Components read it through `useWindowState()` in `renderer/state.ts`.
 */
export function useWithPending(base: WindowState | null): WindowState | null {
  const list = useSyncExternalStore(subscribe, () => pending);
  if (!base) return null;
  const live = list.filter((p) => p.rev === null || p.rev > base.rev);
  if (live.length !== list.length) queueMicrotask(() => setPending(pending.filter((p) => p.rev === null || p.rev > base.rev)));
  return live.reduce((state, p) => p.apply(state), base);
}

/** Changes part of the layout, optimistically. */
export function setLayout(current: WindowLayout, patch: Partial<WindowLayout>, errorTitle: string): Promise<void> {
  const layout = { ...current, ...patch };
  return change((state) => ({ ...state, layout: { ...state.layout, ...patch } }), () => documentsApi.SetLayout(layout), errorTitle);
}

/** Like main (Documents' `commit`): the focused pane follows the active file, and hidden files leave the panes. */
function withFiles(state: WindowState, files: WindowState['fiddle']['files'], activeFile: string | null): WindowState {
  const visible = files.filter((f) => f.visible).map((f) => f.name);
  const panes = followActiveFile(state.layout.panes, state.fiddle.activeFile, activeFile, visible);
  return {
    ...state,
    fiddle: { ...state.fiddle, files, activeFile },
    layout: panes === state.layout.panes ? state.layout : { ...state.layout, panes: [...panes] },
  };
}

export function setActiveFile(name: string, errorTitle: string): Promise<void> {
  return change(
    (state) =>
      withFiles(
        state,
        state.fiddle.files.map((f) => (f.name === name ? { ...f, visible: true } : f)),
        name,
      ),
    () => documentsApi.SetActiveFile(name),
    errorTitle,
  );
}

export function setFileVisible(name: string, visible: boolean, errorTitle: string): Promise<void> {
  return change(
    (state) =>
      withFiles(
        state,
        state.fiddle.files.map((f) => (f.name === name ? { ...f, visible } : f)),
        state.fiddle.activeFile,
      ),
    () => documentsApi.SetFileVisible(name, visible),
    errorTitle,
  );
}

/** Moves a file's tab in front of `before`'s, or to the end. */
export function moveFile(name: string, before: string | null, errorTitle: string): Promise<void> {
  return change(
    (state) => {
      const byName = new Map(state.fiddle.files.map((f) => [f.name, f]));
      const names = moveName(state.fiddle.files.map((f) => f.name), name, before);
      return { ...state, fiddle: { ...state.fiddle, files: names.map((n) => byName.get(n)!) } };
    },
    () => documentsApi.MoveFile(name, before),
    errorTitle,
  );
}

export function setView(view: WindowState['view'], errorTitle: string): Promise<void> {
  return change((state) => ({ ...state, view }), () => documentsApi.SetView(view), errorTitle);
}
