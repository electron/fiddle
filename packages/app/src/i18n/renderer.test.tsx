/** The renderer's i18next setup: locale picking, `<html lang dir>`, live language switching and locale-bound dates. */
import { act, renderHook } from '@testing-library/react';
import type { i18n } from 'i18next';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';

import { initRendererI18n, useFormat, useSyncLocale } from './renderer';

const providerFor =
  (instance: i18n) =>
  ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={instance}>{children}</I18nextProvider>
  );

describe('initRendererI18n', () => {
  it('picks the nearest shipped locale, loads the shell strings and marks <html> with it', async () => {
    const instance = await initRendererI18n('fr-CA');
    expect(instance.language).toBe('fr');
    expect(instance.t('shell:hideSidebar')).toBe('Masquer la barre latérale');
    expect(document.documentElement.lang).toBe('fr');
    expect(document.documentElement.dir).toBe('ltr');
    // A right-to-left language flips the document with it.
    await act(() => instance.changeLanguage('ar-XB'));
    expect(document.documentElement.lang).toBe('ar-XB');
    expect(document.documentElement.dir).toBe('rtl');
  });
});

describe('useSyncLocale', () => {
  it("switches the window's language when the store's locale changes", async () => {
    const instance = await initRendererI18n('en');
    const { rerender } = renderHook((locale?: string) => useSyncLocale(locale), {
      wrapper: providerFor(instance),
    });
    expect(instance.language).toBe('en');
    rerender('de-AT');
    await vi.waitFor(() => expect(instance.language).toBe('de'));
    expect(instance.t('shell:hideSidebar')).toBe('Seitenleiste ausblenden');
    expect(document.documentElement.lang).toBe('de');
  });
});

describe('useFormat', () => {
  it("formats dates in the window's language", async () => {
    const instance = await initRendererI18n('ja');
    const { result } = renderHook(() => useFormat(), { wrapper: providerFor(instance) });
    expect(
      result.current.formatDate(Date.UTC(2026, 8, 13, 12, 0, 0), {
        dateStyle: 'long',
        timeZone: 'UTC',
      }),
    ).toBe('2026年9月13日');
  });
});
