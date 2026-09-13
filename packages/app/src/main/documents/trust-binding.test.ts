/**
 * Trust approval is bound to the approved fiddle (§4): a fiddle swapped into
 * the window later (deep link, LoadGist, OpenDropped) needs its own approval,
 * and callers run the fiddle that was approved.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Fiddle } from '../../fiddle/fiddle';
import { gistOrigin } from '../../fiddle/trust';

let userData = '';
const showMessageBox = vi.fn();
vi.mock('electron', () => ({
  app: { getPath: () => userData, isPackaged: false, getAppPath: () => userData, addRecentDocument: () => undefined },
  dialog: { showMessageBox: (...args: unknown[]) => showMessageBox(...args) },
}));
vi.mock('../windows', () => ({ getWindow: () => undefined }));
vi.mock('../i18n', () => ({
  tm: () => (key: string, options?: Record<string, string>) => (options ? `${key}:${JSON.stringify(options)}` : key),
  t: (key: string) => key,
}));

const ID = '8c5fc0c6a5153d49b5a4a56d3ed9da8f';

function gistFiddle(owner: string, main: string): Fiddle {
  return {
    files: { 'main.js': main },
    hidden: [],
    version: { kind: 'release', version: '30.0.0' },
    modules: {},
    origin: gistOrigin(ID, 'a'.repeat(40), owner),
    source: {},
  };
}

async function setup() {
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
    versions: { releases: () => [], release: () => undefined, localBuild: () => undefined } as never,
    github: { client: () => undefined } as never,
    createWindow: async (id: string) => {
      windows.set(id, {});
    },
  });
  const approved = gistFiddle('octocat', 'approved()');
  await documents.openFiddleWindow({ windowId: 'w', doc: createDoc(approved, 'approved') });
  const swapIn = (owner: string) =>
    documents.updateDoc('w', (doc) => createDoc(gistFiddle(owner, 'attacker()'), owner, { previous: doc }));
  return { documents, approved, swapIn };
}

beforeEach(() => {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'fiddle-trust-'));
  vi.resetModules();
  showMessageBox.mockReset();
});

afterEach(() => {
  fs.rmSync(userData, { recursive: true, force: true });
});

describe('ensureTrusted', () => {
  it('returns the approved fiddle, and asks only once for it', async () => {
    const { documents, approved } = await setup();
    showMessageBox.mockResolvedValue({ response: 0, checkboxChecked: false });

    const first = await documents.ensureTrusted('w', 'auto-bisect');
    expect(first).toMatchObject({ approved: true, allowScripts: false });
    expect(first.approved && first.fiddle.files).toEqual(approved.files);
    await documents.ensureTrusted('w', 'auto-bisect');
    expect(showMessageBox).toHaveBeenCalledTimes(1);
  });

  it('asks again once another fiddle is loaded into the window, e.g. between bisect steps', async () => {
    const { documents, swapIn } = await setup();
    showMessageBox.mockResolvedValue({ response: 0, checkboxChecked: false });
    await documents.ensureTrusted('w', 'auto-bisect');

    swapIn('mallory');
    showMessageBox.mockResolvedValue({ response: 1, checkboxChecked: false });
    expect(await documents.ensureTrusted('w', 'auto-bisect')).toEqual({ approved: false, allowScripts: false });
    expect(showMessageBox).toHaveBeenCalledTimes(2);
  });

  it('approves nothing when the fiddle is swapped while the dialog is open', async () => {
    const { documents, swapIn } = await setup();
    showMessageBox.mockImplementation(async () => {
      swapIn('mallory');
      return { response: 0, checkboxChecked: true };
    });
    expect(await documents.ensureTrusted('w', 'run')).toEqual({ approved: false, allowScripts: false });
  });

  it('asks again for install scripts when an operation needs them and the approval left them off', async () => {
    const { documents } = await setup();
    showMessageBox.mockResolvedValue({ response: 0, checkboxChecked: false });
    await documents.ensureTrusted('w', 'run', { packagesWithInstallScripts: [] });

    showMessageBox.mockResolvedValue({ response: 0, checkboxChecked: true });
    const result = await documents.ensureTrusted('w', 'package', {
      packagesWithInstallScripts: ['esbuild@0.25.0'],
      requireScripts: true,
    });
    expect(result).toMatchObject({ approved: true, allowScripts: true });
    expect(showMessageBox).toHaveBeenCalledTimes(2);
    expect(showMessageBox.mock.calls[1]![0]).toMatchObject({ checkboxLabel: expect.stringContaining('esbuild@0.25.0') });
  });
});
