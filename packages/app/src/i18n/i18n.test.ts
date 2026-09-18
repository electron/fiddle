import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';

import { formatDate, formatNumber, formatRelative } from './format';
import {
  catalogBackend,
  i18nOptions,
  isPseudoLocale,
  localeDirection,
  locales,
  pickLocale,
  shippedLocales,
} from './index';

describe('pickLocale', () => {
  it('prefers an exact tag, then the base language, then English', () => {
    expect(pickLocale(['de-AT', 'ja'])).toBe('de');
    expect(pickLocale(['ja-JP'])).toBe('ja');
    expect(pickLocale(['fr-FR', 'ja-JP'])).toBe('ja');
    expect(pickLocale(['fr-FR', 'en-GB'])).toBe('en');
    expect(pickLocale([])).toBe('en');
  });

  it('picks pseudo-locales only by their exact tag', () => {
    expect(pickLocale(['en-XA'])).toBe('en-XA');
    expect(pickLocale(['ar-xb'])).toBe('ar-XB');
    expect(pickLocale(['ar-EG'])).toBe('en');
    expect(pickLocale(['en-US'])).toBe('en');
  });

  it('keeps pseudo-locales out of the shipped list', () => {
    expect(shippedLocales).toEqual(locales.filter((locale) => !isPseudoLocale(locale)));
    expect(shippedLocales).toContain('en');
    expect(shippedLocales).not.toContain('en-XA');
  });
});

describe('catalogs', () => {
  it('fall back to English key by key', async () => {
    const i18n = createInstance();
    await i18n.init({
      ...i18nOptions('de', ['shell']),
      resources: {
        de: { shell: { hideSidebar: 'Seitenleiste ausblenden' } },
        en: { shell: { hideSidebar: 'Hide sidebar', showSidebar: 'Show sidebar' } },
      },
    });
    expect(i18n.t('hideSidebar')).toBe('Seitenleiste ausblenden');
    expect(i18n.t('showSidebar')).toBe('Show sidebar');
  });

  it('load pseudo-locales, with every Arabic plural form for ar-XB', async () => {
    const xa = createInstance();
    await xa.use(catalogBackend).init(i18nOptions('en-XA', ['shell']));
    expect(xa.t('hideSidebar')).toMatch(/^\[Ĥîðé šîðéƀáŕ/);

    const xb = createInstance();
    await xb.use(catalogBackend).init(i18nOptions('ar-XB', ['shell']));
    const t = xb.getFixedT(null, 'shell') as unknown as (
      key: string,
      options: object,
    ) => string;
    for (const count of [0, 1, 2, 3, 11, 100]) {
      expect(t('errorCount', { count })).toContain(String(count));
    }
  });
});

describe('localeDirection', () => {
  it('is rtl for right-to-left languages and ar-XB', () => {
    expect(localeDirection('ar-XB')).toBe('rtl');
    expect(localeDirection('he')).toBe('rtl');
    expect(localeDirection('en-XA')).toBe('ltr');
    expect(localeDirection('de')).toBe('ltr');
  });
});

describe('format', () => {
  const now = Date.UTC(2026, 8, 13, 12, 0, 0);

  it('formats numbers and dates in the given locale', () => {
    expect(formatNumber('de', 1234.5)).toBe('1.234,5');
    expect(formatNumber('en', 0.25, { style: 'percent' })).toBe('25%');
    expect(formatDate('ja', now, { dateStyle: 'long', timeZone: 'UTC' })).toBe(
      '2026年9月13日',
    );
    expect(formatDate('en', now, { dateStyle: 'medium', timeZone: 'UTC' })).toBe(
      'Sep 13, 2026',
    );
  });

  it('formats relative times in their largest whole unit', () => {
    expect(formatRelative('en', now - 3 * 60_000, now)).toBe('3 minutes ago');
    expect(formatRelative('en', now + 2 * 86_400_000, now)).toBe('in 2 days');
    expect(formatRelative('de', now - 86_400_000, now)).toBe('gestern');
    expect(formatRelative('en', now, now)).toBe('now');
  });
});
