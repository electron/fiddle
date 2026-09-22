/** Links queued before the windows are up wait for the GitHub token restore, so a private gist loads with it. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import type { Fiddle } from '../../fiddle/fiddle';
import { initFakeDocuments } from './test-helpers';

const W = '11111111-1111-4111-8111-111111111111';

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
vi.mock('../i18n');

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
  const order: string[] = [];
  let restore!: () => void;
  const whenReady = vi.fn(() => {
    order.push('whenReady');
    return new Promise<void>((resolve) => (restore = resolve));
  });
  const loadGist = vi.fn(async () => {
    order.push('loadGist');
    throw new Error('offline');
  });
  initFakeDocuments(documents, {
    github: { client: () => ({ loadGist }), whenReady },
  });
  const fiddle: Fiddle = {
    files: { 'main.js': '' },
    hidden: [],
    version: { kind: 'release', version: '30.0.0' },
    modules: {},
    origin: { kind: 'local' },
    source: {},
  };
  await documents.openFiddleWindow({ windowId: W, doc: createDoc(fiddle, 'fiddle') });

  // Arrives before the windows are up (cold start), so it's queued.
  await documents.openDropped(W, `electron-fiddle://gist/${ID}`);
  const started = documents.startDocuments();
  await vi.waitFor(() => expect(whenReady).toHaveBeenCalled());
  order.push('restored');
  restore();
  await started;
  expect(order).toEqual(['whenReady', 'restored', 'loadGist']);
  expect(loadGist).toHaveBeenCalledWith(ID, undefined);
});
