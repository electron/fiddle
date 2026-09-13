/**
 * Renderer logging: the console, plus main's log file through
 * `AppPlatform.Log` (REQUIREMENTS §14). Main redacts secrets before writing.
 */
import { appPlatformApi } from '../../../ipc/renderer';

type Level = 'info' | 'warn' | 'error';

/** Main's `LogText` limit (fiddle.eipc). */
const MAX_LENGTH = 10_000;

function describe(detail: unknown): string {
  if (detail instanceof Error) return `${detail.name}: ${detail.message}\n${detail.stack ?? ''}`;
  if (typeof detail === 'string') return detail;
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

function send(level: Level, message: string, details: unknown[]): void {
  console[level === 'info' ? 'log' : level](message, ...details);
  const text = [message, ...details.map(describe)].join(' ').slice(0, MAX_LENGTH);
  try {
    // The generated `LogLevel` enum's values are its names: 'info', 'warn', 'error'.
    appPlatformApi.Log(level as Parameters<typeof appPlatformApi.Log>[0], text).catch(() => undefined);
  } catch {
    // Not in an app window (tests, the component gallery).
  }
}

export const log = {
  info: (message: string, ...details: unknown[]) => send('info', message, details),
  warn: (message: string, ...details: unknown[]) => send('warn', message, details),
  error: (message: string, ...details: unknown[]) => send('error', message, details),
};

/** Sends uncaught errors and unhandled rejections to main's log. */
export function forwardUncaughtErrors(): void {
  window.addEventListener('error', (event) => log.error('uncaught error', event.error ?? event.message));
  window.addEventListener('unhandledrejection', (event) => log.error('unhandled rejection', event.reason));
}
