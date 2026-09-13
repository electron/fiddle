import i18next, { type i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { catalogBackend, i18nOptions, pickLocale } from './index';

/**
 * Creates the window's i18next instance with only the startup namespace
 * (`common`) loaded. Other namespaces load when a component asks for them.
 */
export async function initRendererI18n(locale: string): Promise<i18n> {
  const instance = i18next.createInstance();
  await instance
    .use(catalogBackend)
    .use(initReactI18next)
    .init(i18nOptions(pickLocale([locale]), ['common']));
  return instance;
}
