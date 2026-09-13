import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { I18nProvider } from 'react-aria-components';
import { useTranslation } from 'react-i18next';

import { useSyncLocale } from '../i18n/renderer';
import { settingsApi, windowApi } from '../ipc/renderer';
import { BUILTIN_THEME, type ThemeData } from '../shared/settings';
import { DialogHost, Toaster } from '../ui';
import { useModelsSynced } from './editor/models';
import { CommandPalette } from './features/palette/CommandPalette';
import { StorageNotices } from './features/settings/StorageNotices';
import { Shell } from './shell/Shell';
import { useAppearance } from './shell/theme';
import { useAppState, useWindowState } from './state';

/** The window: the shell, plus the app-wide mounts (dialogs, toasts, palette). */
export function App() {
  const { t, i18n } = useTranslation('shell');
  const appState = useAppState() ?? null;
  const win = useWindowState();
  const modelsSynced = useModelsSynced();
  const ready = appState !== null && win !== null && modelsSynced;
  const material = appState?.material;
  const locale = appState?.locale;

  // A custom theme's data comes from Settings.GetTheme; the built-in one is Lucent.
  const themeId = appState?.settings.theme ?? BUILTIN_THEME;
  const [customTheme, setCustomTheme] = useState<{ id: string; data: ThemeData | null } | null>(null);
  useEffect(() => {
    if (themeId === BUILTIN_THEME) return;
    let current = true;
    settingsApi.GetTheme(themeId).then(
      (data: ThemeData | null | undefined) => {
        if (current) setCustomTheme({ id: themeId, data: data ?? null });
      },
      (error: unknown) => console.error('[fiddle] loading the theme failed', themeId, error),
    );
    return () => {
      current = false;
    };
  }, [themeId]);
  useAppearance(
    appState?.settings.appearance ?? 'system',
    customTheme?.id === themeId ? customTheme.data : null,
  );

  // Lucent: without an OS material, the tokens swap to their opaque fallbacks.
  useLayoutEffect(() => {
    if (material) document.documentElement.classList.toggle('lu-no-material', material === 'none');
  }, [material]);

  // The language switches live when the setting changes; `<html lang dir>` follows it.
  useSyncLocale(locale);

  // Main shows the window once we report ready: after the first commit with
  // both stores and the editor text, plus two frames so the shell and Monaco
  // (which renders on its own animation frame) have painted. Never shown blank.
  const reported = useRef(false);
  useEffect(() => {
    if (!ready || reported.current) return;
    reported.current = true;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        windowApi.ReportReady().catch((error: unknown) => {
          console.error('[fiddle] ReportReady failed', error);
        });
      }),
    );
  }, [ready]);

  // react-aria's built-in strings (hidden dismiss buttons and the like) follow the UI locale.
  return (
    <I18nProvider locale={i18n.language}>
      <Shell />
      <CommandPalette />
      <DialogHost />
      <Toaster closeLabel={t('dismiss')} aria-label={t('notifications')} />
      <StorageNotices />
    </I18nProvider>
  );
}
