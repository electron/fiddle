import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { pickLocale } from '../i18n';
import { settingsApi, useAppStore, useWindowStore, windowApi } from '../ipc/renderer';
import { BUILTIN_THEME, type ThemeData } from '../shared/settings';
import { DialogHost, Toaster } from '../ui';
import { CommandPalette } from './features/palette/CommandPalette';
import { StorageNotices } from './features/settings/StorageNotices';
import { Shell } from './shell/Shell';
import { useAppearance } from './shell/theme';

/** The window: the shell, plus the app-wide mounts (dialogs, toasts, palette). */
export function App() {
  const { t, i18n } = useTranslation('shell');
  const app = useAppStore();
  const win = useWindowStore();
  const appState = app.state === 'ready' ? app.result : null;
  const ready = appState !== null && win.state === 'ready';
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

  // The language switches live when the setting changes.
  useEffect(() => {
    if (!locale) return;
    document.documentElement.lang = locale;
    const next = pickLocale([locale]);
    if (i18n.language !== next) void i18n.changeLanguage(next);
  }, [locale, i18n]);

  // Main shows the window once we report ready: after the first commit with
  // both stores, plus a frame so the shell has painted. Never shown blank.
  const reported = useRef(false);
  useEffect(() => {
    if (!ready || reported.current) return;
    reported.current = true;
    requestAnimationFrame(() => {
      windowApi.ReportReady().catch((error: unknown) => {
        console.error('[fiddle] ReportReady failed', error);
      });
    });
  }, [ready]);

  return (
    <>
      <Shell />
      <CommandPalette />
      <DialogHost />
      <Toaster closeLabel={t('dismiss')} aria-label={t('notifications')} />
      <StorageNotices />
    </>
  );
}
