/** A window that fails to start is destroyed; its unsaved draft and the session must survive that. */
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let userData = '';
const fakeWindow = Object.assign(new EventEmitter(), {
  setTitle: () => undefined,
  setDocumentEdited: () => undefined,
});

vi.mock('electron', () => ({
  app: {
    getPath: () => userData,
    isPackaged: false,
    getAppPath: () => userData,
    addRecentDocument: () => undefined,
  },
  dialog: { showMessageBox: vi.fn() },
}));
vi.mock('../windows', () => ({ getWindow: () => fakeWindow }));
vi.mock('../i18n', () => ({
  tm: () => (key: string) => key,
  t: (key: string) => key,
}));

const ID = '00000000-0000-4000-8000-0000000000aa';

async function setup(
  createWindow: (id: string, contents: EventEmitter) => Promise<void>,
) {
  const documents = await import('./service');
  const windows = new Map<string, Record<string, unknown>>();
  const hub = {
    app: { settings: { sessionRestore: false } },
    getWindow: (id: string) => windows.get(id),
    updateWindow: (id: string, patch: Record<string, unknown>) => {
      windows.set(id, { ...windows.get(id), ...patch });
      return 1;
    },
  };
  const contents = new Map<string, EventEmitter>();
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
      const own = new EventEmitter();
      contents.set(id, own);
      documents.attachWindow(id, own as never);
      await createWindow(id, own);
    },
  });
  return { documents, contents };
}

async function docWith(name: string) {
  const { createDoc } = await import('./model');
  return createDoc(
    {
      files: { 'main.js': name },
      hidden: [],
      version: { kind: 'release', version: '30.0.0' },
      modules: {},
      origin: { kind: 'local' },
      source: {},
    },
    name,
  );
}

beforeEach(() => {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'fiddle-open-failure-'));
  vi.resetModules();
  fakeWindow.removeAllListeners();
});

afterEach(() => {
  fs.rmSync(userData, { recursive: true, force: true });
});

describe('openFiddleWindow', () => {
  it('drops the doc of a window that fails to start, and keeps its draft for the next launch', async () => {
    const draft = path.join(userData, 'drafts', `${ID}.json`);
    fs.mkdirSync(path.dirname(draft), { recursive: true });
    fs.writeFileSync(draft, '{}');

    const { documents, contents } = await setup(async () => {
      throw new Error('load failed');
    });
    await expect(
      documents.openFiddleWindow({ windowId: ID, doc: await docWith('a') }),
    ).rejects.toThrow('load failed');
    expect(() => documents.getFiddle(ID)).toThrow();

    // The failed window's `destroyed` event arrives after the rejection.
    contents.get(ID)!.emit('destroyed');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fs.existsSync(draft)).toBe(true);
  });
});
