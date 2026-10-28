/** A window that fails to start is destroyed; its unsaved draft and the session must survive that. */
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initFakeDocuments } from './test-helpers';

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
vi.mock('../i18n');

const ID = '00000000-0000-4000-8000-0000000000aa';

async function setup(
  createWindow: (id: string, contents: EventEmitter) => Promise<void>,
) {
  const documents = await import('./service');
  const contents = new Map<string, EventEmitter>();
  initFakeDocuments(documents, {
    onCreateWindow: async (id) => {
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
    const remove = vi.spyOn(fsp, 'rm');
    contents.get(ID)!.emit('destroyed');
    await new Promise((resolve) => setImmediate(resolve));
    expect(remove).not.toHaveBeenCalled();
    expect(fs.existsSync(draft)).toBe(true);
  });
});
