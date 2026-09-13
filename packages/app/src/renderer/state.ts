/**
 * The App and Window stores, subscribed once per window. EIPC adds an IPC
 * listener for every `useAppStore()` and `useWindowStore()` call, so only
 * `StoreProvider` calls them; everything else reads the stores from here.
 */
import { createContext, createElement, use, type ReactNode } from 'react';

import { useAppStore, useWindowStore, type AppStoreState, type WindowStoreState } from '../ipc/renderer';
import type { AppState, WindowState } from '../shared/stores';
import { useWithPending } from './shell/window-state';

const AppStoreContext = createContext<AppStoreState>({ state: 'loading' });
const WindowStoreContext = createContext<WindowStoreState>({ state: 'loading' });

/** Subscribes to both stores. Wrap the window's root in it once. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const app = useAppStore();
  const win = useWindowStore();
  return createElement(
    AppStoreContext.Provider,
    { value: app },
    createElement(WindowStoreContext.Provider, { value: win }, children),
  );
}

/** The App store, or undefined before it has loaded. */
export function useAppState(): AppState | undefined {
  const app = use(AppStoreContext);
  return app.state === 'ready' ? app.result : undefined;
}

/** The Window store with pending optimistic changes on top, or null before it has loaded. */
export function useWindowState(): WindowState | null {
  const win = use(WindowStoreContext);
  return useWithPending(win.state === 'ready' ? win.result : null);
}
