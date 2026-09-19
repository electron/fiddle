import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { FiddleError } from '../../shared/errors';
import {
  defaultSettings,
  fromSparse,
  settingsSchema,
  type SparseSettings,
} from '../../shared/settings';
import type { AppState } from '../../shared/stores';
import { initMainI18n } from '../i18n';
import { createJsonStore, flushAll } from '../persistence/json-store';
import { sanitizeSettings, SettingsService, type SettingsHub } from './service';

let dir: string;
let file: string;

beforeAll(async () => {
  await initMainI18n(['en']);
});

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'settings-'));
  file = path.join(dir, 'settings.json');
});

afterEach(async () => {
  await flushAll();
  await rm(dir, { recursive: true, force: true });
});

function fakeHub(settings = defaultSettings): SettingsHub & { app: AppState } {
  const hub = {
    app: { rev: 0, settings, storageNotices: [] } as unknown as AppState,
    updateApp(patch: Partial<AppState>) {
      hub.app = { ...hub.app, ...patch, rev: hub.app.rev + 1 };
      return hub.app.rev;
    },
  };
  return hub;
}

function open() {
  const store = createJsonStore<SparseSettings>({
    file,
    schema: settingsSchema,
    defaults: {},
    version: 1,
  });
  // As in main: the App store starts from the file.
  const hub = fakeHub(fromSparse(store.get()));
  return { store, hub, service: new SettingsService(hub, store) };
}

const readJson = async () => JSON.parse(await readFile(file, 'utf8')) as unknown;

describe('SettingsService', () => {
  it('applies a change and returns the rev that includes it', () => {
    const { hub, service } = open();
    const rev = service.set('packageManager', 'yarn');
    expect(rev).toBe(1);
    expect(hub.app.rev).toBe(1);
    expect(hub.app.settings.packageManager).toBe('yarn');
  });

  it('keeps settings.json sparse', async () => {
    const { store, service } = open();
    service.set('packageManager', 'yarn');
    service.set('showObsolete', true);
    await store.flush();
    expect(await readJson()).toEqual({
      schemaVersion: 1,
      packageManager: 'yarn',
      showObsolete: true,
    });

    service.set('showObsolete', false);
    service.reset('packageManager');
    await store.flush();
    expect(await readJson()).toEqual({ schemaVersion: 1 });
  });

  it('rejects invalid values and unknown keys without changing anything', () => {
    const { hub, service } = open();
    expect(() => service.set('packageManager', 'pnpm')).toThrow(FiddleError);
    expect(() => service.set('nope', true)).toThrow(/no setting named/);
    expect(hub.app.rev).toBe(0);
  });

  it('keeps keys from newer app versions in the file', async () => {
    await writeFile(
      file,
      JSON.stringify({ schemaVersion: 1, futureSetting: 42, showObsolete: true }),
    );
    const { store, service } = open();
    service.set('packageManager', 'yarn');
    await store.flush();
    expect(await readJson()).toEqual({
      schemaVersion: 1,
      futureSetting: 42,
      showObsolete: true,
      packageManager: 'yarn',
    });
  });

  it('validates an outside settings object per key, and replaces and exports the sparse values', () => {
    const { hub, service } = open();
    service.set('showObsolete', true);
    const { settings, dropped } = sanitizeSettings({
      schemaVersion: 1,
      packageManager: 'yarn',
      theme: 42,
      unknown: 'x',
    });
    expect(settings).toEqual({ packageManager: 'yarn' });
    expect(dropped).toEqual(['theme', 'unknown']);
    service.replace(fromSparse(settings));
    expect(hub.app.settings.showObsolete).toBe(false);
    expect(hub.app.settings.packageManager).toBe('yarn');
    expect(service.exportData()).toEqual({ schemaVersion: 1, packageManager: 'yarn' });
  });

  it('adds and dismisses storage notices', () => {
    const { hub, service } = open();
    service.addStorageNotice({ kind: 'corrupt', file: '/x/state.json', movedTo: '/x/y' });
    expect(hub.app.storageNotices).toEqual([
      { id: expect.any(String), kind: 'corrupt', file: 'state.json' },
    ]);
    service.dismissStorageNotice(hub.app.storageNotices[0]!.id);
    expect(hub.app.storageNotices).toEqual([]);
  });

  it('applies outside edits from disk', async () => {
    const { store, hub, service } = open();
    service.set('showObsolete', true);
    await store.flush();
    await writeFile(file, JSON.stringify({ schemaVersion: 1, packageManager: 'yarn' }));
    expect(store.reload()).toBe(true);
    service.applyFromDisk(store.get());
    expect(hub.app.settings).toMatchObject({
      packageManager: 'yarn',
      showObsolete: false,
    });
    // Our own write, and half-typed JSON, are ignored.
    expect(store.reload()).toBe(false);
    await writeFile(file, '{ "packageManager": ');
    expect(store.reload()).toBe(false);
  });
});
