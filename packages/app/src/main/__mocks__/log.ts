import { vi } from 'vitest';

export const log = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fromRenderer: vi.fn(),
};
export const flushLog = vi.fn(async () => {});
export const logsDir = vi.fn((): string | undefined => undefined);
