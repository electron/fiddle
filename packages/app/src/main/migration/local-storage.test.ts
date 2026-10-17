import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeWindow {
  options: { webPreferences?: Record<string, unknown> };
  loadFile: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  webContents: {
    on: ReturnType<typeof vi.fn>;
    setWindowOpenHandler: ReturnType<typeof vi.fn>;
    executeJavaScript: ReturnType<typeof vi.fn>;
  };
}

const state = vi.hoisted(() => ({
  windows: [] as FakeWindow[],
  script: (async () => '{}') as () => Promise<unknown>,
}));

vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => '/app' },
  BrowserWindow: class {
    constructor(options: FakeWindow['options']) {
      const window: FakeWindow = {
        options,
        loadFile: vi.fn(async () => undefined),
        destroy: vi.fn(),
        webContents: {
          on: vi.fn(),
          setWindowOpenHandler: vi.fn(),
          executeJavaScript: vi.fn(() => state.script()),
        },
      };
      state.windows.push(window);
      return window;
    }
  },
}));

import { readOldLocalStorage } from './local-storage';

let userData: string;

beforeEach(async () => {
  userData = await mkdtemp(path.join(os.tmpdir(), 'fiddle-local-storage-'));
  state.windows.length = 0;
  state.script = async () => '{}';
});

afterEach(async () => {
  vi.useRealTimers();
  await rm(userData, { recursive: true, force: true });
});

describe('readOldLocalStorage', () => {
  it('opens no window for a profile without localStorage', async () => {
    expect(await readOldLocalStorage(userData)).toBeUndefined();
    expect(state.windows).toHaveLength(0);
  });

  it('reads the string values in a locked-down hidden window and destroys it', async () => {
    await mkdir(path.join(userData, 'Local Storage'));
    state.script = async () => JSON.stringify({ fontSize: '14', number: 3, nested: {} });

    expect(await readOldLocalStorage(userData)).toEqual({ fontSize: '14' });

    const [window] = state.windows;
    expect(window!.options).toMatchObject({
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        nodeIntegrationInSubFrames: false,
        webSecurity: true,
      },
    });
    expect(window!.options.webPreferences).not.toHaveProperty('preload');
    expect(window!.webContents.setWindowOpenHandler).toHaveBeenCalled();
    expect(window!.destroy).toHaveBeenCalledOnce();
  });

  it('destroys the window and rejects when reading fails', async () => {
    await mkdir(path.join(userData, 'Local Storage'));
    state.script = async () => {
      throw new Error('script failed');
    };
    await expect(readOldLocalStorage(userData)).rejects.toThrow('script failed');
    expect(state.windows[0]!.destroy).toHaveBeenCalledOnce();
  });

  it('gives up on a window that never answers', async () => {
    await mkdir(path.join(userData, 'Local Storage'));
    vi.useFakeTimers();
    state.script = () => new Promise(() => undefined);

    const result = expect(readOldLocalStorage(userData)).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(10_000);
    await result;
    expect(state.windows[0]!.destroy).toHaveBeenCalledOnce();
  });
});
