/**
 * The Window store with optimistic changes replayed on top (REQUIREMENTS §3,
 * "Optimistic updates"). A change shows at once; it's dropped once the store
 * reaches the `rev` the change method returned, or when main rejects it (the
 * error is shown as a toast).
 */
import { useSyncExternalStore } from 'react';

import type { WindowLayout, WindowState } from '../../shared/stores';
import { documentsApi, useWindowStore } from '../../ipc/renderer';
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

/** The Window store with pending changes on top, or null before it's ready. */
export function useWindowState(): WindowState | null {
  const store = useWindowStore();
  const list = useSyncExternalStore(subscribe, () => pending);
  if (store.state !== 'ready') return null;
  const base = store.result;
  const live = list.filter((p) => p.rev === null || p.rev > base.rev);
  if (live.length !== list.length) queueMicrotask(() => setPending(pending.filter((p) => p.rev === null || p.rev > base.rev)));
  return live.reduce((state, p) => p.apply(state), base);
}

/** Changes part of the layout, optimistically. */
export function setLayout(current: WindowLayout, patch: Partial<WindowLayout>, errorTitle: string): Promise<void> {
  const layout = { ...current, ...patch };
  return change((state) => ({ ...state, layout: { ...state.layout, ...patch } }), () => documentsApi.SetLayout(layout), errorTitle);
}

export function setActiveFile(name: string, errorTitle: string): Promise<void> {
  return change(
    (state) => ({
      ...state,
      fiddle: {
        ...state.fiddle,
        activeFile: name,
        files: state.fiddle.files.map((f) => (f.name === name ? { ...f, visible: true } : f)),
      },
    }),
    () => documentsApi.SetActiveFile(name),
    errorTitle,
  );
}

export function setFileVisible(name: string, visible: boolean, errorTitle: string): Promise<void> {
  return change(
    (state) => ({
      ...state,
      fiddle: {
        ...state.fiddle,
        files: state.fiddle.files.map((f) => (f.name === name ? { ...f, visible } : f)),
      },
    }),
    () => documentsApi.SetFileVisible(name, visible),
    errorTitle,
  );
}

export function setView(view: WindowState['view'], errorTitle: string): Promise<void> {
  return change((state) => ({ ...state, view }), () => documentsApi.SetView(view), errorTitle);
}
