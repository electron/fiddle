// `yarn generate` compiles the catalogs into one module per locale and namespace,
// so startup loads only the namespaces it needs. English is the fallback, key by key.
import type { BackendModule, InitOptions } from 'i18next';

import {
  loaders,
  locales,
  pseudoLocales,
  type Locale,
  type Namespace,
} from './generated/index';

export {
  locales,
  namespaces,
  pseudoLocales,
  type Locale,
  type Namespace,
} from './generated/index';

export const fallbackLocale: Locale = 'en';

/** `en-XA` (accented, longer) and `ar-XB` (right-to-left) are generated for layout checks. */
export function isPseudoLocale(locale: string): boolean {
  return (pseudoLocales as readonly string[]).includes(locale);
}

/** Real languages: the language setting's choices. */
export const shippedLocales: readonly Locale[] = locales.filter(
  (locale) => !isPseudoLocale(locale),
);

const RTL_LANGUAGES = ['ar', 'ckb', 'dv', 'fa', 'he', 'ps', 'sd', 'ug', 'ur', 'yi'];

/** The UI direction of a locale (`ar-XB` is right-to-left, like Arabic). */
export function localeDirection(locale: string): 'ltr' | 'rtl' {
  const language = locale.toLowerCase().split('-')[0] ?? '';
  return RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';
}

/** The locale for a language when the tag itself isn't one: `pt-PT` is `pt-BR`, and Chinese is `zh-TW` by Traditional script or region, else `zh-CN`. */
function languageLocale(language: string, subtags: readonly string[]): string {
  if (language === 'pt') return 'pt-br';
  if (language !== 'zh') return language;
  if (subtags.includes('hans')) return 'zh-cn';
  return subtags.some((s) => ['hant', 'tw', 'hk', 'mo'].includes(s)) ? 'zh-tw' : 'zh-cn';
}

/** Picks the best locale of `available` for a list of BCP 47 tags, most preferred first. */
export function pickLocale(
  preferred: readonly string[],
  available: readonly string[] = locales,
): Locale {
  const find = (code: string) => available.find((l) => l.toLowerCase() === code);
  for (const tag of preferred) {
    const lower = tag.toLowerCase();
    const [language = '', ...subtags] = lower.split('-');
    const match = find(lower) ?? find(languageLocale(language, subtags));
    if (match) return match as Locale;
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
