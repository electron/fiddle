import { beforeEach, describe, expect, it, vi } from 'vitest';

const listeners = new Map<string, () => void>();
vi.mock('electron', () => ({
  app: {
    on: (event: string, listener: () => void) => listeners.set(event, listener),
    quit: vi.fn(),
  },
}));

import { app } from 'electron';

beforeEach(() => {
  listeners.clear();
  vi.mocked(app.quit).mockClear();
  vi.resetModules();
});

async function install(platform: NodeJS.Platform) {
  const lifecycle = await import('./lifecycle');
  lifecycle.installQuitOnLastWindowClosed(platform);
  return { ...lifecycle, closeAll: () => listeners.get('window-all-closed')?.() };
}

describe('quit on last window closed', () => {
  it('keeps the app running when the import reader closes during startup', async () => {
    const { closeAll } = await install('linux');
    // A listener exists, so Electron's default quit doesn't happen either.
    expect(listeners.has('window-all-closed')).toBe(true);
    closeAll();
    expect(app.quit).not.toHaveBeenCalled();
  });

  it('quits when the last window closes after startup, except on macOS', async () => {
    const linux = await install('linux');
    linux.finishStartup();
    linux.closeAll();
    expect(app.quit).toHaveBeenCalledTimes(1);

    vi.mocked(app.quit).mockClear();
    vi.resetModules();
    const mac = await install('darwin');
    mac.finishStartup();
    mac.closeAll();
    expect(app.quit).not.toHaveBeenCalled();
  });
});
