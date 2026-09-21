import i18next, { type i18n } from 'i18next';
import { useEffect, useMemo } from 'react';
import { initReactI18next, useTranslation } from 'react-i18next';

import { formatDate } from './format';
import {
  catalogBackend,
  i18nOptions,
  localeDirection,
  pickLocale,
  type Namespace,
} from './index';

// What the shell reads on its first render; loading them up front saves a suspend
// per namespace. The rest load on demand.
const SHELL_NAMESPACES: Namespace[] = [
  'shell',
  'run',
  'versions',
  'gists',
  'packages',
  'palette',
  'main',
  'onboarding',
  // StorageNotices mounts with App.
  'settings',
];

/** `<html lang dir>`: a right-to-left locale mirrors the chrome through CSS logical properties. */
export function applyDocumentLocale(
  locale: string,
  root: HTMLElement = document.documentElement,
): void {
  root.lang = locale;
  root.dir = localeDirection(locale);
}

/** Creates the window's i18next instance with the shell's namespaces loaded. */
export async function initRendererI18n(locale: string): Promise<i18n> {
  const instance = i18next.createInstance();
  instance.on('languageChanged', (language) => applyDocumentLocale(language));
  await instance
    .use(catalogBackend)
    .use(initReactI18next)
    .init(i18nOptions(pickLocale([locale]), SHELL_NAMESPACES));
  applyDocumentLocale(instance.language);
  return instance;
}

/** Switches the window's strings when the App store's `locale` changes. Mount once, near the root. */
export function useSyncLocale(locale: string | undefined): void {
  const { i18n } = useTranslation();
  useEffect(() => {
    if (!locale) return;
    const next = pickLocale([locale]);
    if (i18n.language !== next) void i18n.changeLanguage(next);
  }, [i18n, locale]);
}

/** `formatDate` bound to the window's locale. */
export function useFormat() {
  const { i18n } = useTranslation();
  const locale = i18n.language;
  return useMemo(
    () => ({
      formatDate: (value: Date | number, options?: Intl.DateTimeFormatOptions) =>
        formatDate(locale, value, options),
    }),
    [locale],
  );
}
