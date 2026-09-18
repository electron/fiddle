/**
 * Split view: main keeps `layout.panes` in step with the fiddle, so
 * the focused pane follows `activeFile` however it changes (tab, sidebar,
 * palette, tour, a new file), and hidden or removed files leave their panes.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFiddle } from '../../fiddle/fiddle';
import { DEFAULT_LAYOUT, type WindowLayout } from '../../shared/stores';

let userData = '';
vi.mock('electron', () => ({
  app: {
    getPath: () => userData,
    isPackaged: false,
    getAppPath: () => userData,
    addRecentDocument: () => undefined,
  },
  dialog: { showMessageBox: vi.fn() },
}));
vi.mock('../windows', () => ({
  getWindow: () => undefined,
  sendWindowCommand: () => undefined,
}));
vi.mock('../i18n', () => ({ tm: () => (key: string) => key, t: (key: string) => key }));

beforeEach(() => {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'fiddle-panes-'));
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(userData, { recursive: true, force: true });
});

async function setup(panes: string[]) {
  const documents = await import('./service');
  const model = await import('./model');
  const windows = new Map<string, Record<string, unknown>>();
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
    github: { client: () => undefined } as never,
    npm: { packument: async () => ({ versions: {} }) } as never,
    createWindow: async (id: string, init: Record<string, unknown>) => {
      windows.set(id, { ...init });
    },
  });
  const fiddle = createFiddle({
    files: { 'main.js': 'm', 'preload.js': 'p', 'renderer.js': 'r', 'index.html': 'h' },
    version: { kind: 'release', version: '30.0.0' },
  });
  const layout: WindowLayout = { ...DEFAULT_LAYOUT, panes };
  await documents.openFiddleWindow({
    windowId: 'w',
    doc: model.createDoc(fiddle, 'fiddle'),
    layout,
  });
  const layoutNow = () => (windows.get('w') as { layout: WindowLayout }).layout;
  return { documents, model, panes: () => layoutNow().panes };
}

describe('panes follow the fiddle', () => {
  it('shows a newly focused file in the focused pane, and only moves focus to a file that has one', async () => {
    const { documents, model, panes } = await setup(['main.js', 'renderer.js']);
    documents.updateDoc('w', (doc) => model.docSetActiveFile(doc, 'renderer.js'));
    expect(panes()).toEqual(['main.js', 'renderer.js']);
    documents.updateDoc('w', (doc) => model.docSetActiveFile(doc, 'index.html'));
    expect(panes()).toEqual(['main.js', 'index.html']);
    // A new file takes focus, so it takes the focused pane too.
    documents.updateDoc('w', (doc) => model.docAddFile(doc, 'styles.css'));
    expect(panes()).toEqual(['main.js', 'styles.css']);
  });

  it('closes the pane of a hidden or removed file, and the split below two panes', async () => {
    const { documents, model, panes } = await setup([
      'main.js',
      'renderer.js',
      'index.html',
    ]);
    documents.updateDoc('w', (doc) => model.docRemoveFile(doc, 'index.html'));
    expect(panes()).toEqual(['main.js', 'renderer.js']);
    documents.updateDoc('w', (doc) => model.docSetFileVisible(doc, 'renderer.js', false));
    expect(panes()).toEqual([]);
  });

  it('keeps the pane of a renamed file, focused or not', async () => {
    const { documents, panes } = await setup(['main.js', 'renderer.js']);
    documents.renameFile('w', 'renderer.js', 'view.js');
    expect(panes()).toEqual(['main.js', 'view.js']);
    documents.renameFile('w', 'main.js', 'main.mjs');
    expect(panes()).toEqual(['main.mjs', 'view.js']);
  });

  it('leaves an unsplit window and plain edits alone', async () => {
    const { documents, model, panes } = await setup([]);
    documents.updateDoc('w', (doc) => model.docSetActiveFile(doc, 'renderer.js'));
    expect(panes()).toEqual([]);
    const before = panes();
    documents.editFile('w', 'main.js', 'changed', 1);
    expect(documents.getFiddle('w').files['main.js']).toBe('changed');
    expect(panes()).toBe(before);
  });
});
