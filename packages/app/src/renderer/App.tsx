import { useEffect, useRef } from 'react';
import { I18nProvider } from 'react-aria-components';
import { useTranslation } from 'react-i18next';

import { useSyncLocale } from '../i18n/renderer';
import { windowApi } from '../ipc/renderer';
import { DialogHost, Toaster } from '../ui';
import { useModelsSynced } from './editor/models';
import { log, UpdateNotice } from './features/about';
import { useKeybindings } from './features/commands/keybindings';
import { useWindowCommands } from './features/commands/window-commands';
import { CommandPalette } from './features/palette/CommandPalette';
import { StorageNotices } from './features/settings/StorageNotices';
import { ErrorBoundary, RegionError } from './shell/ErrorBoundary';
import { Shell } from './shell/Shell';
import { useAppearance } from './shell/theme';
import { useAppState, useStoreError, useWindowState } from './state';

export function App() {
  const { t, i18n } = useTranslation('shell');
  const appState = useAppState() ?? null;
  const win = useWindowState();
  useKeybindings();
  useWindowCommands();
  const modelsSynced = useModelsSynced();
  // A store that failed to load never becomes ready: report anyway, so the window shows its error.
  const storeError = useStoreError();
  const ready =
    storeError !== undefined || (appState !== null && win !== null && modelsSynced);
  useEffect(() => {
    if (storeError) log.error('a store failed to load', storeError);
  }, [storeError]);
  useAppearance();
  useSyncLocale(appState?.locale);

  // Main shows the window once we report ready. No frames are awaited: a window that has never been shown gets few
  // or none, so this waits on state alone (EditorPane draws its first text without a frame).
  const reported = useRef(false);
  useEffect(() => {
    if (!ready || reported.current) return;
    reported.current = true;
    windowApi.ReportReady().catch((error: unknown) => {
      log.error('ReportReady failed', error);
    });
  }, [ready]);

  // react-aria's built-in strings (hidden dismiss buttons and the like) follow the UI locale.
  return (
    <I18nProvider locale={i18n.language}>
      <ErrorBoundary region="shell" fill>
        {storeError ? <RegionError fill /> : <Shell />}
      </ErrorBoundary>
      <ErrorBoundary region="palette">
        <CommandPalette />
      </ErrorBoundary>
      <DialogHost />
      <Toaster closeLabel={t('dismiss')} aria-label={t('notifications')} />
      <StorageNotices />
      <UpdateNotice />
    </I18nProvider>
  );
}
