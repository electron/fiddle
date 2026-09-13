/**
 * i18n shared by main and the renderer. Catalogs are compiled by
 * `yarn generate` into one small module per locale and namespace
 * (src/i18n/generated/), so startup never parses a full catalog:
 *
 * - main loads only `main` (menus and dialogs);
 * - a window loads only `common` before first paint, and other namespaces
 *   lazily through `useTranslation('<ns>')`.
 *
 * English is the fallback, key by key.
 */
import type { BackendModule, InitOptions } from 'i18next';

import { loaders, locales, pseudoLocales, type Locale, type Namespace } from './generated/index';

export {
  locales,
  namespaces,
  pseudoLocales,
  type Locale,
  type Namespace,
} from './generated/index';

export const fallbackLocale: Locale = 'en';

/**
 * `en-XA` (accented, about 40% longer) and `ar-XB` (right-to-left, mirrored)
 * are generated from English by `yarn generate`, for e2e and layout checks.
 * Select one with the locale setting, or `FIDDLE_LOCALE` in dev and test runs.
 */
export function isPseudoLocale(locale: string): boolean {
  return (pseudoLocales as readonly string[]).includes(locale);
}

/** Real languages: the language setting's choices and macOS's CFBundleLocalizations. */
export const shippedLocales: readonly Locale[] = locales.filter((locale) => !isPseudoLocale(locale));

const RTL_LANGUAGES = ['ar', 'ckb', 'dv', 'fa', 'he', 'ps', 'sd', 'ug', 'ur', 'yi'];

/** The UI direction of a locale (`ar-XB` is right-to-left, like Arabic). */
export function localeDirection(locale: string): 'ltr' | 'rtl' {
  const language = locale.toLowerCase().split('-')[0] ?? '';
  return RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';
}

/** Picks the best shipped locale for a list of BCP 47 tags, most preferred first. */
export function pickLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const lower = tag.toLowerCase();
    const exact = locales.find((locale) => locale.toLowerCase() === lower);
    if (exact) return exact;
    const language = lower.split('-')[0];
    const base = locales.find((locale) => locale.toLowerCase() === language);
    if (base) return base;
  }
  return fallbackLocale;
}

/** An i18next backend that reads the compiled catalog modules. */
export const catalogBackend: BackendModule = {
  type: 'backend',
  init() {},
  read(language, namespace, callback) {
    const load = (
      loaders as Record<
        string,
        Partial<Record<string, () => Promise<{ default: unknown }>>>
      >
    )[language]?.[namespace];
    if (!load) {
      callback(null, {});
      return;
    }
    load().then(
      (module) => callback(null, module.default as Record<string, string>),
      (error: unknown) => callback(error instanceof Error ? error : String(error), null),
    );
  },
};

export function i18nOptions(lng: Locale, ns: Namespace[]): InitOptions {
  return {
    lng,
    fallbackLng: fallbackLocale,
    supportedLngs: [...locales],
    load: 'currentOnly',
    ns,
    defaultNS: ns[0],
    keySeparator: false,
    // React escapes output; native menus and dialogs are plain text.
    interpolation: { escapeValue: false },
  };
}
