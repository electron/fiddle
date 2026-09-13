/**
 * Settings in the renderer: the `App` store's settings with this window's
 * pending changes on top (see ./optimistic.ts). `set` and `reset` show the
 * change at once, call main, and reconcile on the returned rev. A rejected
 * change is dropped and shown as a toast.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

import { settingsApi, useAppStore } from '../../../ipc/renderer';
import { FiddleError } from '../../../shared/errors';
import { defaultSettings, type SettingKey, type Settings } from '../../../shared/settings';
import type { AppState } from '../../../shared/stores';
import { showToast } from '../../../ui';
import { outstanding, withPending, type PendingChange } from './optimistic';

// One pending list per window, shared by every component that shows settings.
let pending: PendingChange[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function replace(next: PendingChange[]): void {
  pending = next;
  for (const listener of listeners) listener();
}

async function commit(
  key: SettingKey,
  value: unknown,
  send: () => Promise<number>,
  onError: (error: FiddleError) => void,
): Promise<void> {
  const id = nextId++;
  replace([...pending, { id, key, value }]);
  try {
    const rev = await send();
    replace(pending.map((change) => (change.id === id ? { ...change, rev } : change)));
  } catch (error) {
    replace(pending.filter((change) => change.id !== id));
    onError(FiddleError.from(error));
  }
}

export interface UseSettings {
  /** The App store, once it has loaded. */
  app: AppState | undefined;
  settings: Settings;
  set<K extends SettingKey>(key: K, value: Settings[K]): void;
  reset(key: SettingKey): void;
}

export function useSettings(): UseSettings {
  const { t } = useTranslation('settings');
  const store = useAppStore();
  const app = store.state === 'ready' ? store.result : undefined;
  const rev = app?.rev ?? 0;
  const list = useSyncExternalStore(subscribe, () => pending);

  useEffect(() => {
    const left = outstanding(pending, rev);
    if (left.length !== pending.length) replace(left);
  }, [rev, list]);

  const settings = useMemo(
    () => withPending(app?.settings ?? defaultSettings, list, rev),
    [app?.settings, list, rev],
  );

  const onError = useCallback(
    (error: FiddleError) => showToast({ tone: 'error', title: t('changeFailed'), description: error.message }),
    [t],
  );
  const set = useCallback(
    <K extends SettingKey>(key: K, value: Settings[K]) => {
      void commit(key, value, () => settingsApi.SetSetting(key, value), onError);
    },
    [onError],
  );
  const reset = useCallback(
    (key: SettingKey) => {
      void commit(key, defaultSettings[key], () => settingsApi.ResetSetting(key), onError);
    },
    [onError],
  );

  return { app, settings, set, reset };
}

/** Runs a settings action (import, export, theme and file actions) and toasts its error. */
export function useSettingsAction(): (action: () => Promise<unknown>) => void {
  const { t } = useTranslation('settings');
  return useCallback(
    (action) => {
      action().catch((error: unknown) =>
        showToast({ tone: 'error', title: t('actionFailed'), description: FiddleError.from(error).message }),
      );
    },
    [t],
  );
}
