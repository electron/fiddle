import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';

import { formatDate } from './format';
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
  const available = [
    'en',
    'de',
    'ja',
    'zh-CN',
    'zh-TW',
    'pt-BR',
    'es',
    'ru',
    'ko',
    'fr',
    'tr',
    'en-XA',
  ];
  const cases: [string[], string][] = [
    [['de-AT', 'ja'], 'de'],
    [['fr-FR', 'ja-JP'], 'fr'],
    [['es-MX'], 'es'],
    [['ko-KR'], 'ko'],
    [['tr-TR'], 'tr'],
    [['ru-RU'], 'ru'],
    [['zh'], 'zh-CN'],
    [['zh-CN'], 'zh-CN'],
    [['zh-SG'], 'zh-CN'],
    [['zh-Hans'], 'zh-CN'],
    [['zh-Hans-CN'], 'zh-CN'],
    [['zh-Hans-HK'], 'zh-CN'],
    [['zh-TW'], 'zh-TW'],
    [['zh-HK'], 'zh-TW'],
    [['zh-MO'], 'zh-TW'],
    [['zh-Hant'], 'zh-TW'],
    [['zh-Hant-TW'], 'zh-TW'],
    [['zh-Hant-CN'], 'zh-TW'],
    [['pt'], 'pt-BR'],
    [['pt-BR'], 'pt-BR'],
    [['pt-PT'], 'pt-BR'],
    [['it-IT', 'pt-PT', 'ja'], 'pt-BR'],
    [['it-IT', 'en-GB'], 'en'],
    [['en-XA'], 'en-XA'],
    [[], 'en'],
  ];

  it.each(cases)('maps %j to %s', (tags, expected) => {
    expect(pickLocale(tags, available)).toBe(expected);
  });

  it('only picks locales that exist', () => {
    expect(pickLocale(['zh-TW', 'pt-PT', 'ja'], ['en', 'ja', 'zh-CN'])).toBe('ja');
    expect(pickLocale(['zh-Hant', 'zh'], ['en', 'zh-CN'])).toBe('zh-CN');
    expect(pickLocale(['pt-PT'], ['en', 'de'])).toBe('en');
  });

  it('defaults to the real locales', () => {
    expect(pickLocale(['de-AT'])).toBe('de');
    expect(pickLocale(['ja-JP'])).toBe('ja');
    expect(pickLocale(['xx-YY'])).toBe('en');
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

  it('formats dates in the given locale', () => {
    expect(formatDate('ja', now, { dateStyle: 'long', timeZone: 'UTC' })).toBe(
      '2026年9月13日',
    );
    expect(formatDate('en', now, { dateStyle: 'medium', timeZone: 'UTC' })).toBe(
      'Sep 13, 2026',
    );
  });
});
