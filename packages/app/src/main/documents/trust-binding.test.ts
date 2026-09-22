/** Trust approval is bound to the approved fiddle: one swapped into the window later needs its own. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Fiddle } from '../../fiddle/fiddle';
import { gistOrigin } from '../../fiddle/trust';
import { flushAndRemove, initFakeDocuments } from './test-helpers';

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
vi.mock('../windows', () => ({ getWindow: () => undefined }));
vi.mock('../i18n');

const ID = '8c5fc0c6a5153d49b5a4a56d3ed9da8f';
const modules = { esbuild: '^0.20.0', lodash: '^4.17.0' };
const packuments: Record<string, unknown> = {
  esbuild: {
    'dist-tags': { latest: '0.20.0' },
    versions: { '0.20.0': { hasInstallScript: true } },
  },
  lodash: { 'dist-tags': { latest: '4.17.21' }, versions: { '4.17.21': {} } },
};
const packument = async (name: string) => packuments[name];

function gistFiddle(
  owner: string,
  main: string,
  modules: Record<string, string> = {},
): Fiddle {
  return {
    files: { 'main.js': main },
    hidden: [],
    version: { kind: 'release', version: '30.0.0' },
    modules,
    origin: gistOrigin(ID, 'a'.repeat(40), owner),
    source: {},
  };
}

async function setup(
  options: {
    packument?: (name: string, signal?: AbortSignal) => Promise<unknown>;
    modules?: Record<string, string>;
  } = {},
) {
  const documents = await import('./service');
  const { createDoc } = await import('./model');
  initFakeDocuments(documents, {
    npm: options.packument && { packument: options.packument },
  });
  const approved = gistFiddle('octocat', 'approved()', options.modules);
  await documents.openFiddleWindow({
    windowId: W,
    doc: createDoc(approved, 'approved'),
  });
  const swapIn = (owner: string) =>
    documents.updateDoc(W, (doc) =>
      createDoc(gistFiddle(owner, 'attacker()'), owner, { previous: doc }),
    );
  return { documents, approved, swapIn };
}

beforeEach(() => {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'fiddle-trust-'));
  vi.resetModules();
  showMessageBox.mockReset();
});

afterEach(() => flushAndRemove(userData));

describe('ensureTrusted', () => {
  it('returns the approved fiddle, and asks only once for it', async () => {
    const { documents, approved } = await setup();
    showMessageBox.mockResolvedValue({ response: 0, checkboxChecked: false });

    const first = await documents.ensureTrusted(W, 'auto-bisect');
    expect(first).toMatchObject({ approved: true, allowScripts: false });
    expect(first.approved && first.fiddle.files).toEqual(approved.files);
    await documents.ensureTrusted(W, 'auto-bisect');
    expect(showMessageBox).toHaveBeenCalledTimes(1);
  });

  it('asks again once another fiddle is loaded into the window, e.g. between bisect steps', async () => {
    const { documents, swapIn } = await setup();
    showMessageBox.mockResolvedValue({ response: 0, checkboxChecked: false });
    await documents.ensureTrusted(W, 'auto-bisect');

    swapIn('mallory');
    showMessageBox.mockResolvedValue({ response: 1, checkboxChecked: false });
    expect(await documents.ensureTrusted(W, 'auto-bisect')).toEqual({
      approved: false,
      allowScripts: false,
    });
    expect(showMessageBox).toHaveBeenCalledTimes(2);
  });

  it('approves nothing when the fiddle is swapped while the dialog is open', async () => {
    const { documents, swapIn } = await setup();
    showMessageBox.mockImplementation(async () => {
      swapIn('mallory');
      return { response: 0, checkboxChecked: true };
    });
    expect(await documents.ensureTrusted(W, 'run')).toEqual({
      approved: false,
      allowScripts: false,
    });
  });

  it('runs a local fiddle without asking', async () => {
    const { documents } = await setup();
    documents.updateDoc(W, (doc) => ({
      ...doc,
      fiddle: { ...doc.fiddle, origin: { kind: 'local' } },
    }));
    expect(await documents.ensureTrusted(W, 'run')).toMatchObject({
      approved: true,
      allowScripts: true,
      fiddle: { files: { 'main.js': 'approved()' } },
    });
    expect(showMessageBox).not.toHaveBeenCalled();
  });

  it('lists where the code comes from, its files and its dependencies in the prompt', async () => {
    const { documents } = await setup({
      packument: async () => ({ versions: {} }),
      modules: { lodash: '^4.17.0' },
    });
    showMessageBox.mockResolvedValue({ response: 1, checkboxChecked: false });

    await documents.ensureTrusted(W, 'run');

    const { detail } = showMessageBox.mock.calls[0]![0] as { detail: string };
    expect(detail).toContain(
      `detailOrigin:{"origin":"gist:octocat/${ID}@${'a'.repeat(40)}"}`,
    );
    expect(detail).toContain('detailFiles:{"files":"main.js"}');
    expect(detail).toContain('detailDependencies:{"dependencies":"lodash@^4.17.0"}');
  });

  it('asks again for install scripts when an operation needs them and the approval left them off', async () => {
    const { documents } = await setup({ packument, modules });
    showMessageBox.mockResolvedValue({ response: 0, checkboxChecked: false });
    await documents.ensureTrusted(W, 'run');

    showMessageBox.mockResolvedValue({ response: 0, checkboxChecked: true });
    const result = await documents.ensureTrusted(W, 'package', { requireScripts: true });
    expect(result).toMatchObject({
      approved: true,
      allowScripts: true,
      scripted: ['esbuild@0.20.0'],
    });
    expect(showMessageBox).toHaveBeenCalledTimes(2);
    expect(showMessageBox.mock.calls[1]![0]).toMatchObject({
      checkboxLabel: expect.stringContaining('esbuild@0.20.0'),
    });
  });
});

describe('install scripts', () => {
  it('reads the registry through the injected client and lists the modules with install scripts', async () => {
    const lookup = vi.fn(packument);
    const { documents } = await setup({ packument: lookup, modules });
    showMessageBox.mockResolvedValue({ response: 0, checkboxChecked: false });
    const result = await documents.ensureTrusted(W, 'package', { requireScripts: true });
    expect(result).toMatchObject({ scripted: ['esbuild@0.20.0'] });
    expect(lookup).toHaveBeenCalledWith('esbuild', expect.any(AbortSignal));
  });

  it('lists every module when the registry cannot be read, so the user is asked about all of them', async () => {
    const { documents } = await setup({
      packument: async () => {
        throw new Error('offline');
      },
      modules,
    });
    showMessageBox.mockResolvedValue({ response: 0, checkboxChecked: false });
    const result = await documents.ensureTrusted(W, 'package', { requireScripts: true });
    expect(result).toMatchObject({ scripted: ['esbuild', 'lodash'] });
    expect(showMessageBox.mock.calls[0]![0]).toMatchObject({
      checkboxLabel: expect.stringContaining('esbuild, lodash'),
    });
  });

  it('asks nothing once an approval allowed install scripts, without reading the registry again', async () => {
    const lookup = vi.fn(packument);
    const { documents } = await setup({ packument: lookup, modules });
    showMessageBox.mockResolvedValue({ response: 0, checkboxChecked: true });
    await documents.ensureTrusted(W, 'run');
    lookup.mockClear();

    const result = await documents.ensureTrusted(W, 'package', { requireScripts: true });
    expect(result).toMatchObject({ approved: true, allowScripts: true });
    expect(lookup).not.toHaveBeenCalled();
    expect(showMessageBox).toHaveBeenCalledTimes(1);
  });

  it('asks nothing for a trusted fiddle', async () => {
    const lookup = vi.fn();
    const { documents } = await setup({ packument: lookup, modules });
    documents.updateDoc(W, (doc) => ({
      ...doc,
      fiddle: { ...doc.fiddle, origin: { kind: 'local' } },
    }));
    const result = await documents.ensureTrusted(W, 'package', { requireScripts: true });
    expect(result).toMatchObject({ approved: true, allowScripts: true });
    expect(lookup).not.toHaveBeenCalled();
    expect(showMessageBox).not.toHaveBeenCalled();
  });
});
