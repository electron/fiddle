import i18next, { type TFunction } from 'i18next';

import { catalogBackend, i18nOptions, pickLocale, type Locale } from '../i18n';

const instance = i18next.createInstance();

/** Loads only main's own namespace (menus and dialogs) for the best matching locale. */
export async function initMainI18n(preferred: readonly string[]): Promise<Locale> {
  const locale = pickLocale(preferred);
  await instance.use(catalogBackend).init(i18nOptions(locale, ['main']));
  return locale;
}

/** Translates a key in the `main` namespace. */
export const t: TFunction<'main'> = instance.getFixedT(null, 'main');
