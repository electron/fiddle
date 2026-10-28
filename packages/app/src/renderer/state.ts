// EIPC adds an IPC listener for every `useAppStore()` and `useWindowStore()` call, so only `StoreProvider` calls
// them. Main pushes new objects each time; `shareEqual` keeps unchanged parts as they were, so `memo` can skip work.
import { createContext, createElement, use, useState, type ReactNode } from 'react';

import {
  useAppStore,
  useWindowStore,
  type AppStoreState,
  type WindowStoreState,
} from '../ipc/renderer';
import type { AppState, WindowState } from '../shared/stores';
import { shareEqual } from './share-equal';
import { useWithPending } from './shell/window-state';

const AppStoreContext = createContext<AppStoreState>({ state: 'loading' });
const WindowStoreContext = createContext<WindowStoreState>({ state: 'loading' });

/** `store` with the parts of its state that equal the last render's kept as they were. */
function useShared<S extends AppStoreState | WindowStoreState>(store: S): S {
  const [last, setLast] = useState(store);
  const shared = store === last ? last : shareEqual(last, store);
  if (shared !== last) setLast(shared);
  return shared;
}

/** Subscribes to both stores. Wrap the window's root in it once. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const app = useShared(useAppStore());
  const win = useShared(useWindowStore());
  return createElement(
    AppStoreContext.Provider,
    { value: app },
    createElement(WindowStoreContext.Provider, { value: win }, children),
  );
}

export function useAppState(): AppState | undefined {
  const app = use(AppStoreContext);
  return app.state === 'ready' ? app.result : undefined;
}

/** The Window store with pending optimistic changes on top, or null before it has loaded. */
export function useWindowState(): WindowState | null {
  const win = use(WindowStoreContext);
  return useWithPending(win.state === 'ready' ? win.result : null);
}

/** The error a store failed to load with, if one did. */
export function useStoreError(): Error | undefined {
  const app = use(AppStoreContext);
  const win = use(WindowStoreContext);
  return app.state === 'error'
    ? app.error
    : win.state === 'error'
      ? win.error
      : undefined;
}
