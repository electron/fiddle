/**
 * Locale-aware formatting: every `Intl` call passes the UI locale, never the
 * system default. Pass the active locale: `i18n.language` in a renderer (or use
 * `useFormat()` from `./renderer`), `hub.app.locale` in main. Formatters are
 * cached per locale and options.
 */
const cache = new Map<
  string,
  Intl.DateTimeFormat | Intl.NumberFormat | Intl.RelativeTimeFormat
>();

function cached<
  T extends Intl.DateTimeFormat | Intl.NumberFormat | Intl.RelativeTimeFormat,
>(kind: string, locale: string, options: object | undefined, create: () => T): T {
  const key = `${kind}|${locale}|${JSON.stringify(options ?? {})}`;
  let formatter = cache.get(key);
  if (!formatter) {
    formatter = create();
    cache.set(key, formatter);
  }
  return formatter as T;
}

/** A date and/or time, by default like "13 Sep 2026, 14:05" in the locale's own order. */
export function formatDate(
  locale: string,
  value: Date | number,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
): string {
  return cached(
    'date',
    locale,
    options,
    () => new Intl.DateTimeFormat(locale, options),
  ).format(value);
}

export function formatNumber(
  locale: string,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return cached(
    'number',
    locale,
    options,
    () => new Intl.NumberFormat(locale, options),
  ).format(value);
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
];

/** Time relative to `now`, in its largest whole unit: "3 minutes ago", "yesterday", "in 2 days". */
export function formatRelative(
  locale: string,
  value: Date | number,
  now: Date | number = Date.now(),
): string {
  const seconds = Math.round((Number(value) - Number(now)) / 1000);
  const [unit, size] = UNITS.find(([, size]) => Math.abs(seconds) >= size) ?? [
    'second',
    1,
  ];
  const format = cached(
    'relative',
    locale,
    undefined,
    () => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }),
  );
  return format.format(Math.trunc(seconds / size), unit);
}
