import i18next, { type TFunction } from 'i18next';

import {
  catalogBackend,
  i18nOptions,
  namespaces,
  pickLocale,
  type Locale,
  type Namespace,
} from '../i18n';

const instance = i18next.createInstance();

/**
 * Main loads `main` (command labels and menus) plus every slice namespace
 * named `main<Slice>` (e.g. `mainDocuments`) for its dialogs and notices.
 * Renderer namespaces are never loaded here.
 */
export const mainNamespaces = namespaces.filter(
  (ns) => ns === 'main' || /^main[A-Z]/.test(ns),
) as Namespace[];

export async function initMainI18n(preferred: readonly string[]): Promise<Locale> {
  const locale = pickLocale(preferred);
  await instance.use(catalogBackend).init(i18nOptions(locale, mainNamespaces));
  return locale;
}

/** Switches main's strings to the best shipped match for `preferred` (Settings slice). */
export async function setMainLocale(preferred: readonly string[]): Promise<Locale> {
  const locale = pickLocale(preferred);
  if (instance.language !== locale) await instance.changeLanguage(locale);
  return locale;
}

/** Translates a key in the `main` namespace. */
export const t: TFunction<'main'> = instance.getFixedT(null, 'main');

/** Translator for a main-process slice namespace, e.g. `tm('mainDocuments')`. */
export function tm<N extends Namespace>(ns: N): TFunction<N> {
  return instance.getFixedT(null, ns);
}
