import { useSyncExternalStore } from 'react';

import { toastQueue, type ToastContent } from '../../ui';

export interface NotificationEntry {
  /** The toast's key in the queue. */
  key: string;
  /** Epoch milliseconds when it appeared. */
  time: number;
  content: ToastContent;
}

export interface NotificationsSnapshot {
  entries: readonly NotificationEntry[];
  unseen: number;
}

/** The part of react-aria's `ToastQueue` the history reads. */
interface Queue {
  visibleToasts: readonly { key: string; content: ToastContent }[];
  subscribe(listener: () => void): () => void;
}

export const HISTORY_LIMIT = 50;

export function createToastHistory(queue: Queue, now: () => number = Date.now) {
  let snapshot: NotificationsSnapshot = { entries: [], unseen: 0 };
  /** Keys already recorded: the list's, and the ones showing. */
  let known = new Set<string>();
  const listeners = new Set<() => void>();
  const set = (next: NotificationsSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };

  // Toasts past the visible limit wait in the queue, so each is recorded when it
  // first shows. The queue lists the newest first, like the history.
  const dispose = queue.subscribe(() => {
    const fresh = queue.visibleToasts.filter((toast) => !known.has(toast.key));
    if (fresh.length === 0) return;
    const added = fresh.map((toast) => ({
      key: toast.key,
      time: now(),
      content: toast.content,
    }));
    const entries = [...added, ...snapshot.entries].slice(0, HISTORY_LIMIT);
    known = new Set([
      ...entries.map((entry) => entry.key),
      ...queue.visibleToasts.map((toast) => toast.key),
    ]);
    set({ entries, unseen: snapshot.unseen + fresh.length });
  });

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    markSeen(): void {
      if (snapshot.unseen) set({ ...snapshot, unseen: 0 });
    },
    clear(): void {
      set({ entries: [], unseen: 0 });
    },
    dispose,
  };
}

export type ToastHistory = ReturnType<typeof createToastHistory>;

/** The window's history, recording from the first toast on. */
export const toastHistory = createToastHistory(toastQueue);

export function useToastHistory(
  history: ToastHistory = toastHistory,
): NotificationsSnapshot {
  return useSyncExternalStore(history.subscribe, history.getSnapshot);
}
