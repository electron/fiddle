import { app } from 'electron';
import i18next, { type TFunction } from 'i18next';

import {
  catalogBackend,
  i18nOptions,
  namespaces,
  pickLocale,
  type Locale,
  type Namespace,
} from '../i18n';
import { isTestMode } from './test-mode';

const instance = i18next.createInstance();

/**
 * `FIDDLE_LOCALE` (e.g. `en-XA`, `ar-XB`, `de`) wins over the setting and the
 * OS in dev and test runs. Packaged builds ignore it.
 */
function withOverride(preferred: readonly string[]): readonly string[] {
  const forced = process.env.FIDDLE_LOCALE;
  return forced && (!app.isPackaged || isTestMode()) ? [forced, ...preferred] : preferred;
}

/**
 * Main loads `main` (command labels and menus) plus every `main<Name>`
 * namespace (e.g. `mainDocuments`) for its dialogs and notices. Renderer
 * namespaces are never loaded here.
 */
const mainNamespaces = namespaces.filter(
  (ns) => ns === 'main' || /^main[A-Z]/.test(ns),
) as Namespace[];

export async function initMainI18n(preferred: readonly string[]): Promise<Locale> {
  const locale = pickLocale(withOverride(preferred));
  await instance.use(catalogBackend).init(i18nOptions(locale, mainNamespaces));
  return locale;
}

/** Switches main's strings to the best shipped match for `preferred`. */
export async function setMainLocale(preferred: readonly string[]): Promise<Locale> {
  const locale = pickLocale(withOverride(preferred));
  if (instance.language !== locale) await instance.changeLanguage(locale);
  return locale;
}

/** Translates a key in the `main` namespace. */
export const t: TFunction<'main'> = instance.getFixedT(null, 'main');

/** Translator for a `main<Name>` namespace, e.g. `tm('mainDocuments')`. */
export function tm<N extends Namespace>(ns: N): TFunction<N> {
  return instance.getFixedT(null, ns);
}
