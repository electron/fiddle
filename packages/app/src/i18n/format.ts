// Every `Intl` call passes the UI locale, never the system default: `i18n.language`
// in a renderer (or `useFormat()`), `hub.app.locale` in main.
const cache = new Map<string, Intl.DateTimeFormat>();

/** A date and/or time, by default like "13 Sep 2026, 14:05" in the locale's own order. */
export function formatDate(
  locale: string,
  value: Date | number,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
): string {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = cache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    cache.set(key, formatter);
  }
  return formatter.format(value);
}
