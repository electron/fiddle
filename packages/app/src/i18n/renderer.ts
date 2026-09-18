import i18next, { type i18n } from 'i18next';
import { useEffect, useMemo } from 'react';
import { initReactI18next, useTranslation } from 'react-i18next';

import { formatDate, formatNumber, formatRelative } from './format';
import {
  catalogBackend,
  i18nOptions,
  localeDirection,
  pickLocale,
  type Namespace,
} from './index';

/**
 * What the shell reads on its first render. Loading them together, next to the
 * App chunk, saves one round of fetches and re-renders per namespace that a
 * component would otherwise suspend on. Settings and the rest load on demand.
 */
const SHELL_NAMESPACES: Namespace[] = [
  'shell',
  'run',
  'versions',
  'gists',
  'packages',
  'palette',
  'main',
  'onboarding',
];

/** `<html lang dir>`: a right-to-left locale mirrors the chrome through CSS logical properties. */
export function applyDocumentLocale(
  locale: string,
  root: HTMLElement = document.documentElement,
): void {
  root.lang = locale;
  root.dir = localeDirection(locale);
}

/**
 * Creates the window's i18next instance with the shell's namespaces loaded.
 * Other namespaces load when a component asks for them. `<html lang dir>`
 * follow every language change.
 */
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

/**
 * Switches the window's strings when the App store's `locale` changes, so a
 * new language applies at once. Mount once, near the root.
 */
export function useSyncLocale(locale: string | undefined): void {
  const { i18n } = useTranslation();
  useEffect(() => {
    if (!locale) return;
    const next = pickLocale([locale]);
    if (i18n.language !== next) void i18n.changeLanguage(next);
  }, [i18n, locale]);
}

/** `formatDate`, `formatNumber` and `formatRelative` bound to the window's locale. */
export function useFormat() {
  const { i18n } = useTranslation();
  const locale = i18n.language;
  return useMemo(
    () => ({
      formatDate: (value: Date | number, options?: Intl.DateTimeFormatOptions) =>
        formatDate(locale, value, options),
      formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
        formatNumber(locale, value, options),
      formatRelative: (value: Date | number, now?: Date | number) =>
        formatRelative(locale, value, now),
    }),
    [locale],
  );
}
