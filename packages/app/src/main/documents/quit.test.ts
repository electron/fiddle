/** The quit prompt for unsaved windows: `before-quit` is held, and a cancelled quit drops a pending relaunch. */
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let userData = '';
const showMessageBox = vi.fn();
const cancelRelaunch = vi.fn();

vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events');
  return {
    app: Object.assign(new EventEmitter(), {
      getPath: () => userData,
      getAppPath: () => userData,
      isPackaged: false,
      quit: vi.fn(),
      requestSingleInstanceLock: () => true,
      addRecentDocument: () => undefined,
    }),
    dialog: { showMessageBox: (...args: unknown[]) => showMessageBox(...args) },
  };
});
vi.mock('../windows', () => ({ getWindow: () => undefined }));
vi.mock('../platform/locale', () => ({ cancelRelaunch: () => cancelRelaunch() }));
vi.mock('../i18n', () => ({
  tm: () => (key: string) => key,
  t: (key: string) => key,
}));

import { app } from 'electron';

import type { Fiddle } from '../../fiddle/fiddle';

const WINDOW_ID = '00000000-0000-4000-8000-000000000001';
const mockApp = app as unknown as EventEmitter & { quit: ReturnType<typeof vi.fn> };

const fiddle: Fiddle = {
  files: { 'main.js': 'edited' },
  hidden: [],
  version: { kind: 'release', version: '30.0.0' },
  modules: {},
  origin: { kind: 'local' },
  source: {},
};

async function setup(dirty: boolean) {
  const documents = await import('./service');
  const { createDoc } = await import('./model');
  const windows = new Map<string, Record<string, unknown>>();
  const hub = {
    app: { settings: { sessionRestore: false } },
    getWindow: (id: string) => windows.get(id),
    updateWindow: (id: string, patch: Record<string, unknown>) => {
      windows.set(id, { ...windows.get(id), ...patch });
      return 1;
    },
  };
  documents.initDocuments({
    hub: hub as never,
    platform: 'linux',
    versions: {
      releases: () => [],
      release: () => undefined,
      localBuild: () => undefined,
    } as never,
    github: { client: () => undefined } as never,
    npm: { packument: async () => ({ versions: {} }) } as never,
    createWindow: async (id: string) => {
      windows.set(id, {});
    },
  });
  documents.installEarlyDocumentHandlers();
  const doc = createDoc(
    fiddle,
    'fiddle',
    dirty ? { baseline: { 'main.js': 'saved' } } : {},
  );
  await documents.openFiddleWindow({ windowId: WINDOW_ID, doc });
}

function beforeQuit(): { preventDefault: ReturnType<typeof vi.fn> } {
  const event = { preventDefault: vi.fn() };
  mockApp.emit('before-quit', event);
  return event;
}

beforeEach(() => {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'fiddle-quit-'));
  vi.resetModules();
  mockApp.removeAllListeners();
  mockApp.quit.mockClear();
  showMessageBox.mockReset();
  cancelRelaunch.mockClear();
});

afterEach(() => {
  fs.rmSync(userData, { recursive: true, force: true });
});

describe('before-quit', () => {
  it('lets the quit through when no window has unsaved changes', async () => {
    await setup(false);
    expect(beforeQuit().preventDefault).not.toHaveBeenCalled();
    expect(showMessageBox).not.toHaveBeenCalled();
  });

  it('holds the quit and asks once when a window has unsaved changes', async () => {
    await setup(true);
    showMessageBox.mockResolvedValue({ response: 1, checkboxChecked: false });
    expect(beforeQuit().preventDefault).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(showMessageBox).toHaveBeenCalledOnce());
  });

  it('cancels a pending relaunch when the user cancels the quit', async () => {
    await setup(true);
    showMessageBox.mockResolvedValue({ response: 1, checkboxChecked: false });
    beforeQuit();
    await vi.waitFor(() => expect(cancelRelaunch).toHaveBeenCalledOnce());
    expect(mockApp.quit).not.toHaveBeenCalled();
  });

  it('quits on a later turn once the user confirms', async () => {
    await setup(true);
    showMessageBox.mockResolvedValue({ response: 0, checkboxChecked: false });
    beforeQuit();
    await vi.waitFor(() => expect(mockApp.quit).toHaveBeenCalledOnce());
    expect(cancelRelaunch).not.toHaveBeenCalled();
    // The second `before-quit`, from that quit, goes through.
    expect(beforeQuit().preventDefault).not.toHaveBeenCalled();
  });
});
