/**
 * Settings in the renderer: the `App` store's settings with this window's
 * pending changes on top (see ../../optimistic.ts). `set` and `reset` show the
 * change at once, call main, and reconcile on the returned rev. A rejected
 * change is dropped and shown as a toast.
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { settingsApi } from '../../../ipc/renderer';
import {
  defaultSettings,
  type SettingKey,
  type Settings,
} from '../../../shared/settings';
import type { AppState } from '../../../shared/stores';
import { createOptimistic } from '../../optimistic';
import { useAppState } from '../../state';
import { toastError } from '../../toast-error';

// One per window, shared by every component that shows settings.
const settingsChanges = createOptimistic<Settings>();

export interface UseSettings {
  /** The App store, once it has loaded. */
  app: AppState | undefined;
  settings: Settings;
  /** Resolves to whether main accepted the change; a rejection has already been shown as a toast. */
  set<K extends SettingKey>(key: K, value: Settings[K]): Promise<boolean>;
  reset(key: SettingKey): void;
}

export function useSettings(): UseSettings {
  const { t } = useTranslation('settings');
  const app = useAppState();
  const settings = settingsChanges.use(app?.settings ?? defaultSettings, app?.rev ?? 0);
  const failedTitle = t('changeFailed');

  const set = useCallback(
    <K extends SettingKey>(key: K, value: Settings[K]) =>
      settingsChanges.change(
        (current) => ({ ...current, [key]: value }),
        () => settingsApi.SetSetting(key, value),
        failedTitle,
      ),
    [failedTitle],
  );
  const reset = useCallback(
    (key: SettingKey) => {
      void settingsChanges.change(
        (current) => ({ ...current, [key]: defaultSettings[key] }),
        () => settingsApi.ResetSetting(key),
        failedTitle,
      );
    },
    [failedTitle],
  );

  return { app, settings, set, reset };
}

/** Runs a settings action (import, export, theme and file actions) and toasts its error. */
export function useSettingsAction(): (action: () => Promise<unknown>) => void {
  const { t } = useTranslation('settings');
  return useCallback(
    (action) => {
      action().catch((error: unknown) => toastError(error, t('actionFailed')));
    },
    [t],
  );
}
