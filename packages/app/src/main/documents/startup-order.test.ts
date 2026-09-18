/**
 * Startup ordering: links queued before the windows are up wait for
 * the GitHub token restore, so a private gist loads with the user's token.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import type { Fiddle } from '../../fiddle/fiddle';

let userData = '';
const showMessageBox = vi.fn();
vi.mock('electron', () => ({
  app: {
    getPath: () => userData,
    isPackaged: false,
    getAppPath: () => userData,
    addRecentDocument: () => undefined,
  },
  dialog: { showMessageBox: (...args: unknown[]) => showMessageBox(...args) },
}));
vi.mock('../windows', () => ({
  getWindow: () => undefined,
  sendWindowCommand: () => undefined,
}));
vi.mock('../i18n', () => ({ tm: () => (key: string) => key, t: (key: string) => key }));

const ID = '8c5fc0c6a5153d49b5a4a56d3ed9da8f';

beforeEach(() => {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'fiddle-startup-'));
  vi.resetModules();
  showMessageBox.mockReset();
  showMessageBox.mockResolvedValue({ response: 1, checkboxChecked: false });
});

afterEach(() => {
  fs.rmSync(userData, { recursive: true, force: true });
});

it('handles a queued gist link only once the GitHub token is restored', async () => {
  const documents = await import('./service');
  const { createDoc } = await import('./model');
  const windows = new Map<string, Record<string, unknown>>();
  let restored!: () => void;
  const whenReady = vi.fn(() => new Promise<void>((resolve) => (restored = resolve)));
  const loadGist = vi.fn(async () => {
    throw new Error('offline');
  });
  documents.initDocuments({
    hub: {
      app: { settings: { sessionRestore: false } },
      getWindow: (id: string) => windows.get(id),
      updateWindow: (id: string, patch: Record<string, unknown>) => {
        windows.set(id, { ...windows.get(id), ...patch });
        return 1;
      },
    } as never,
    platform: 'linux',
    versions: {
      releases: () => [],
      release: () => undefined,
      localBuild: () => undefined,
    } as never,
    github: { client: () => ({ loadGist }), whenReady } as never,
    npm: { packument: async () => ({ versions: {} }) } as never,
    createWindow: async (id: string) => {
      windows.set(id, {});
    },
  });
  const fiddle: Fiddle = {
    files: { 'main.js': '' },
    hidden: [],
    version: { kind: 'release', version: '30.0.0' },
    modules: {},
    origin: { kind: 'local' },
    source: {},
  };
  await documents.openFiddleWindow({ windowId: 'w', doc: createDoc(fiddle, 'fiddle') });

  // Arrives before the windows are up (cold start), so it's queued.
  await documents.openDropped('w', `electron-fiddle://gist/${ID}`);
  const started = documents.startDocuments();
  await vi.waitFor(() => expect(whenReady).toHaveBeenCalled());
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(loadGist).not.toHaveBeenCalled();

  restored();
  await started;
  expect(loadGist).toHaveBeenCalledWith(ID, undefined);
});
