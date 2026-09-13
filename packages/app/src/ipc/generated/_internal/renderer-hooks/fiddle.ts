/* eslint-disable */

import { useState, useEffect } from 'react';
import type { IAppRenderer, AppState } from '../../common/fiddle.js';
const App = (globalThis as any)['fiddle']?.['App'] as Partial<IAppRenderer> | undefined;
export type AppStoreState =
  | { state: 'missing' }
  | { state: 'loading' }
  | { state: 'ready'; result: AppState }
  | { state: 'error'; error: Error };

export function useAppStore(): AppStoreState {
  const [storeState, setStoreState] = useState<AppStoreState>(() => {
    if (!App?.AppStore) {
      return { state: 'missing' };
    }
    return { state: 'loading' };
  });

  useEffect(() => {
    const store = App?.AppStore;
    if (!store) return;

    let cancelled = false;

    store.getState()
      .then((result: AppState) => {
        if (!cancelled) {
          setStoreState({ state: 'ready', result });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStoreState({ state: 'error', error: error instanceof Error ? error : new Error(String(error)) });
        }
      });

    const unsubscribe = store.onStateChange((result: AppState) => {
      if (!cancelled) {
        setStoreState({ state: 'ready', result });
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return storeState;
}
import type { IWindowRenderer, WindowState } from '../../common/fiddle.js';
const Window = (globalThis as any)['fiddle']?.['Window'] as Partial<IWindowRenderer> | undefined;
export type WindowStoreState =
  | { state: 'missing' }
  | { state: 'loading' }
  | { state: 'ready'; result: WindowState }
  | { state: 'error'; error: Error };

export function useWindowStore(): WindowStoreState {
  const [storeState, setStoreState] = useState<WindowStoreState>(() => {
    if (!Window?.WindowStore) {
      return { state: 'missing' };
    }
    return { state: 'loading' };
  });

  useEffect(() => {
    const store = Window?.WindowStore;
    if (!store) return;

    let cancelled = false;

    store.getState()
      .then((result: WindowState) => {
        if (!cancelled) {
          setStoreState({ state: 'ready', result });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStoreState({ state: 'error', error: error instanceof Error ? error : new Error(String(error)) });
        }
      });

    const unsubscribe = store.onStateChange((result: WindowState) => {
      if (!cancelled) {
        setStoreState({ state: 'ready', result });
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return storeState;
}