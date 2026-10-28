import { vi } from 'vitest';

/** The key itself, with any options as JSON: `saved:{"name":"x"}`. */
export const t = (key: string, options?: Record<string, unknown>): string =>
  options ? `${key}:${JSON.stringify(options)}` : key;
export const tm = () => t;
export const initMainI18n = vi.fn(async () => 'en');
export const setMainLocale = vi.fn(async () => 'en');
