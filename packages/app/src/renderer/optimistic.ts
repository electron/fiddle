/**
 * Optimistic changes on top of a store: a change shows at once and stays until the store reaches the `rev` main
 * answered with, so an older push can't undo it. It goes when main rejects it. Keep one per store.
 */
import { useEffect, useMemo } from 'react';

import { createStore, useStore } from './store';
import { toastError } from './toast-error';

interface Change<S> {
  apply: (state: S) => S;
  /** The store rev that includes the change, once main has answered. */
  rev: number | null;
}

export interface Optimistic<S> {
  /** Shows `apply` at once, then sends it. Resolves to whether main accepted it; a rejection is toasted under `errorTitle`. */
  change(
    apply: (state: S) => S,
    send: () => Promise<number>,
    errorTitle: string,
  ): Promise<boolean>;
  /** `base`, at store `rev`, with the changes the store hasn't caught up with replayed in order. Null stays null. */
  use(base: S, rev: number): S;
  use(base: S | null, rev: number): S | null;
}

export function createOptimistic<S>(): Optimistic<S> {
  const changes = createStore<readonly Change<S>[]>([]);
  const open = (rev: number) => (change: Change<S>) =>
    change.rev === null || change.rev > rev;

  async function change(
    apply: (state: S) => S,
    send: () => Promise<number>,
    errorTitle: string,
  ): Promise<boolean> {
    const entry: Change<S> = { apply, rev: null };
    changes.set([...changes.get(), entry]);
    try {
      entry.rev = await send();
      changes.set([...changes.get()]);
      return true;
    } catch (error) {
      changes.set(changes.get().filter((c) => c !== entry));
      toastError(error, errorTitle);
      return false;
    }
  }

  function use(base: S, rev: number): S;
  function use(base: S | null, rev: number): S | null;
  function use(base: S | null, rev: number): S | null {
    const list = useStore(changes);
    useEffect(() => {
      if (changes.get().some((c) => !open(rev)(c)))
        changes.set(changes.get().filter(open(rev)));
    }, [list, rev]);
    return useMemo(() => {
      if (base === null) return null;
      let state: S = base;
      for (const c of list.filter(open(rev))) state = c.apply(state);
      return state;
    }, [base, list, rev]);
  }

  return { change, use };
}
