import { app } from 'electron';

/** FIDDLE_DEV_ELECTRON_FLAGS: extra flags for runs, e.g. `--no-sandbox` in a root container. Dev builds only. */
export function devElectronFlags(): string[] {
  if (import.meta.env.MODE === 'production' || app.isPackaged) return [];
  return (process.env.FIDDLE_DEV_ELECTRON_FLAGS ?? '').split(' ').filter(Boolean);
}
