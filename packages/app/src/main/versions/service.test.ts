/** The Electron versions service: mirrors, the release list, installs and removals. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { InstallState } from '@electron/fiddle-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorCode } from '../../shared/errors';
import type { VersionsState } from '../../shared/stores';
import { MIRRORS } from '../../shared/settings';

vi.mock('electron', () => ({
  app: { getSystemLocale: () => 'en-US' },
  net: { fetch: vi.fn() },
}));
vi.mock('../dialogs', () => ({
  confirm: vi.fn(),
  messageBox: vi.fn(),
  pickFolder: vi.fn(),
}));
vi.mock('../i18n', () => ({
  tm: () => (key: string, options?: Record<string, unknown>) =>
    options ? `${key}:${JSON.stringify(options)}` : key,
}));
vi.mock('../log', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { Installer } = await import('@electron/fiddle-core');
const { VersionsService, fetchReleaseList, mirrorsFor, readReleaseList } =
  await import('./service');
const { cachePaths } = await import('./paths');
const { flushAll } = await import('../persistence/json-store');
const dialogs = vi.mocked(await import('../dialogs'));

const DEFAULT_ELECTRON = 'https://github.com/electron/electron/releases/download/';
const DEFAULT_NIGHTLY = 'https://github.com/electron/nightlies/releases/download/';

describe('mirrorsFor', () => {
  const base = {
    mirror: 'auto' as const,
    customMirrorElectron: '',
    customMirrorNightly: '',
  };

  it('picks the China mirror for automatic mode only on a zh-CN locale', () => {
    expect(mirrorsFor(base, 'zh-CN')).toEqual({
      electronMirror: MIRRORS.china.electron,
      electronNightlyMirror: MIRRORS.china.nightly,
    });
    expect(mirrorsFor(base, 'zh-cn').electronMirror).toBe(MIRRORS.china.electron);
    expect(mirrorsFor(base, 'zh-TW').electronMirror).toBe(DEFAULT_ELECTRON);
    expect(mirrorsFor(base, 'en-US')).toEqual({
      electronMirror: DEFAULT_ELECTRON,
      electronNightlyMirror: DEFAULT_NIGHTLY,
    });
  });

  it('follows an explicit choice whatever the locale', () => {
    expect(mirrorsFor({ ...base, mirror: 'china' }, 'en-US').electronMirror).toBe(
      MIRRORS.china.electron,
    );
    expect(mirrorsFor({ ...base, mirror: 'default' }, 'zh-CN').electronMirror).toBe(
      DEFAULT_ELECTRON,
    );
  });

  it('uses custom mirrors, and adds the trailing slash @electron/get needs', () => {
    const custom = { ...base, mirror: 'custom' as const };
    expect(
      mirrorsFor(
        {
          ...custom,
          customMirrorElectron: 'https://mirror.example.com/electron',
          customMirrorNightly: 'https://n.example.com/',
        },
        'en-US',
      ),
    ).toEqual({
      electronMirror: 'https://mirror.example.com/electron/',
      electronNightlyMirror: 'https://n.example.com/',
      override: true,
    });
  });

  it('overrides the environment only for a mirror the user chose', () => {
    const custom = { ...base, mirror: 'custom' as const };
    expect(mirrorsFor(base, 'zh-CN').override).toBeUndefined();
    expect(mirrorsFor(base, 'en-US').override).toBeUndefined();
    expect(mirrorsFor({ ...base, mirror: 'default' }, 'zh-CN').override).toBeUndefined();
    expect(mirrorsFor({ ...base, mirror: 'china' }, 'en-US').override).toBe(true);
    expect(mirrorsFor(custom, 'en-US').override).toBeUndefined();
    expect(
      mirrorsFor({ ...custom, customMirrorNightly: 'https://n.example.com/' }, 'en-US')
        .override,
    ).toBe(true);
  });

  it('falls back to the default for an empty or non-https custom mirror', () => {
    const custom = { ...base, mirror: 'custom' as const };
    expect(mirrorsFor(custom, 'en-US')).toEqual({
      electronMirror: DEFAULT_ELECTRON,
      electronNightlyMirror: DEFAULT_NIGHTLY,
    });
    expect(
      mirrorsFor(
        {
          ...custom,
          customMirrorElectron: 'http://insecure.example.com/',
          customMirrorNightly: 'not a url',
        },
        'en-US',
      ),
    ).toEqual({
      electronMirror: DEFAULT_ELECTRON,
      electronNightlyMirror: DEFAULT_NIGHTLY,
    });
  });
});

let dir = '';
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fiddle-versions-'));
});
afterEach(async () => {
  vi.useRealTimers();
  // `deleteAll` saves the local builds in the background: let that land before the folder goes.
  await flushAll();
  fs.rmSync(dir, { recursive: true, force: true });
});

// Newer than the bundled snapshot, which a cached list must not lose to.
const release = (version: string) => ({ version, date: '2099-01-01', node: '24.0.0' });
const listText = (...versions: string[]) => JSON.stringify(versions.map(release));

function setup(options: { active?: string[]; cached?: string } = {}) {
  const cache = cachePaths(path.join(dir, 'cache'));
  /** Local build IDs some window uses. */
  const activeBuilds = new Set<string>();
  if (options.cached !== undefined) {
    fs.mkdirSync(cache.root, { recursive: true });
    fs.writeFileSync(cache.releases, options.cached);
  }
  const updateApp = vi.fn();
  const hub = {
    app: {
      settings: { mirror: 'default', customMirrorElectron: '', customMirrorNightly: '' },
    },
    updateApp,
  };
  const fetch = vi.fn<(url: string) => Promise<Response>>();
  const onRemoved = vi.fn();
  const service = new VersionsService({
    hub: hub as never,
    cache,
    userData: path.join(dir, 'user'),
    releasesUrl: 'https://example.test/releases.json',
    fetch,
    activeVersions: () => ({
      releases: new Set(options.active ?? []),
      builds: activeBuilds,
    }),
    onRemoved,
  });
  /** What each `updateApp` published. */
  const published = () =>
    updateApp.mock.calls.map((call) => (call[0] as { versions: VersionsState }).versions);
  const rev = () => published().at(-1)?.releasesRev;
  return { service, cache, fetch, updateApp, onRemoved, rev, published, activeBuilds };
}

/** A folder under the temp dir with an Electron binary in it, like a local build. */
function makeBuild(...segments: string[]): string {
  const folder = path.join(dir, ...segments);
  const exec = Installer.getExecPath(folder);
  fs.mkdirSync(path.dirname(exec), { recursive: true });
  fs.writeFileSync(exec, '');
  return folder;
}

const respond = (text: string) => async () => new Response(text);
const HOURS = 60 * 60 * 1000;
const backdate = (file: string, ms: number) => {
  const then = new Date(Date.now() - ms);
  fs.utimesSync(file, then, then);
};

describe('release list', () => {
  it('falls back to the bundled list when the cached one is not a release list', async () => {
    const { cache } = setup({ cached: '{"oops":true}' });
    const { rows, fresh } = await readReleaseList(cache);
    expect(rows.length).toBeGreaterThan(100);
    expect(fresh).toBe(false);
  });

  it('prefers the bundled list to an older cached one', async () => {
    const older = JSON.stringify([{ version: '30.0.0', date: '2026-01-01' }]);
    const { cache } = setup({ cached: older });
    expect((await readReleaseList(cache)).rows.length).toBeGreaterThan(100);
  });

  it('skips the network at startup while the cached list is fresh, and fetches once it is old', async () => {
    const { service, cache, fetch } = setup({ cached: listText('30.0.0') });
    fetch.mockImplementation(respond(listText('30.0.0')));
    await service.init();
    expect(fetch).not.toHaveBeenCalled();

    backdate(cache.releases, 5 * HOURS);
    await service.init();
    expect(fetch).toHaveBeenCalledTimes(1);
    // That fetch runs in the background and ends by rewriting the cache: let it, before the folder goes.
    await vi.waitFor(
      () => expect(Date.now() - fs.statSync(cache.releases).mtimeMs).toBeLessThan(HOURS),
      { timeout: 4000 },
    );
  });

  it('publishes a refreshed list, caches its text, and skips a refresh that changes nothing', async () => {
    const first = listText('30.0.0', '29.0.0');
    const { service, cache, fetch, updateApp, rev } = setup({ cached: first });
    backdate(cache.releases, 5 * HOURS);
    fetch.mockImplementation(respond(first));
    await service.init();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await service.refresh();
    expect(updateApp).toHaveBeenCalledTimes(1);
    expect(rev()).toBe(1);

    const second = listText('31.0.0', '30.0.0', '29.0.0');
    fetch.mockImplementation(respond(second));
    await service.refresh();
    expect(rev()).toBe(2);
    expect(service.releases().map((row) => row.version)).toEqual([
      '31.0.0',
      '30.0.0',
      '29.0.0',
    ]);
    expect(fs.readFileSync(cache.releases, 'utf8')).toBe(second);
  });

  it('keeps a fetched list when it cannot be cached', async () => {
    const { service, cache, fetch } = setup();
    // A file where the cache folder should be, so nothing can be written under it.
    fs.writeFileSync(cache.root, '');
    fetch.mockImplementation(respond(listText('99.0.0')));
    await service.refresh();
    expect(service.releases().map((row) => row.version)).toEqual(['99.0.0']);
  });

  it('caches a list fetched outside the service for the next start to read', async () => {
    const { cache, fetch } = setup();
    fs.mkdirSync(cache.root, { recursive: true });
    fetch.mockImplementation(respond(listText('40.0.0')));
    const fetched = await fetchReleaseList(cache, 'https://example.test/r.json', fetch);
    expect(fetched.rows.map((row) => row.version)).toEqual(['40.0.0']);
    const read = await readReleaseList(cache);
    expect(read).toMatchObject({ rows: fetched.rows, fresh: true });
  });

  it('reports a failed refresh to the caller, and keeps the list it has', async () => {
    const { service, fetch } = setup({ cached: listText('30.0.0') });
    fetch.mockRejectedValue(new Error('offline'));
    await service.init();
    await expect(service.refresh()).rejects.toMatchObject({
      code: ErrorCode.network,
      message: 'refreshFailed',
    });
    fetch.mockImplementation(async () => new Response('nope', { status: 503 }));
    await expect(service.refresh()).rejects.toMatchObject({ code: ErrorCode.network });
    expect(service.releases().map((row) => row.version)).toEqual(['30.0.0']);
  });
});

describe('downloads', () => {
  it('publishes progress only when the percent changes', async () => {
    const { service, updateApp } = setup({ cached: listText('30.0.0') });
    await service.init();
    updateApp.mockClear();
    vi.useFakeTimers();
    vi.spyOn(service.installer, 'install').mockImplementation(
      async (_version, options) => {
        for (const percent of [0.1, 0.1, 0.101, 0.2])
          options?.progressCallback?.({ percent } as never);
        return '/electron';
      },
    );
    await service.install('30.0.0');
    vi.advanceTimersByTime(100);
    const percents = updateApp.mock.calls.map(
      (call) =>
        (call[0] as { versions: { installs: Record<string, { percent?: number }> } })
          .versions.installs['30.0.0']?.percent,
    );
    expect(percents).toEqual([20]);
  });

  it('refuses a version the release list lacks, and wraps an installer failure in a network error that names the version', async () => {
    const { service } = setup({ cached: listText('30.0.0') });
    await service.init();
    const install = vi
      .spyOn(service.installer, 'install')
      .mockRejectedValue(new Error('ECONNRESET'));
    await expect(service.install('99.0.0')).rejects.toMatchObject({
      code: ErrorCode.notFound,
    });
    expect(install).not.toHaveBeenCalled();
    await expect(service.install('30.0.0')).rejects.toMatchObject({
      code: ErrorCode.network,
      message: 'downloadFailed:{"version":"30.0.0","message":"ECONNRESET"}',
    });
  });

  it('downloads every listed release that is missing, notes a failure and carries on', async () => {
    const { service, published } = setup({
      cached: listText('31.0.0', '30.0.0', '29.0.0'),
    });
    await service.init();
    vi.spyOn(service.installer, 'state').mockImplementation((version) =>
      version === '31.0.0' ? InstallState.installed : InstallState.missing,
    );
    const install = vi
      .spyOn(service.installer, 'install')
      .mockImplementation(async (version) => {
        if (version === '30.0.0') throw new Error('offline');
        return '/electron';
      });
    await service.downloadAll(['31.0.0', '30.0.0', '29.0.0', '0.0.1-unlisted']);
    expect(install.mock.calls.map(([version]) => version)).toEqual(['30.0.0', '29.0.0']);
    const flags = published().map((v) => [v.downloadingAll, v.downloadAllFailed]);
    expect(flags.at(-2)).toEqual([true, false]);
    expect(flags.at(-1)).toEqual([false, true]);
  });

  it('stops downloading all at the version in flight, without calling that a failure', async () => {
    const { service, published } = setup({ cached: listText('30.0.0', '29.0.0') });
    await service.init();
    vi.spyOn(service.installer, 'state').mockReturnValue(InstallState.missing);
    const install = vi.spyOn(service.installer, 'install').mockImplementation(
      (_version, options) =>
        new Promise<string>((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const all = service.downloadAll(['30.0.0', '29.0.0']);
    await vi.waitFor(() => expect(install).toHaveBeenCalledTimes(1));
    // A second request while one runs starts nothing.
    await service.downloadAll(['29.0.0']);
    expect(install).toHaveBeenCalledTimes(1);

    service.stopDownloadAll();
    await all;
    expect(install).toHaveBeenCalledTimes(1);
    expect(published().at(-1)).toMatchObject({
      downloadingAll: false,
      downloadAllFailed: false,
    });
  });
});

describe('local builds', () => {
  beforeEach(() => {
    dialogs.pickFolder.mockReset();
    dialogs.confirm.mockReset();
    dialogs.messageBox.mockReset();
  });

  it('registers a folder once, publishes it, and names a window after it', () => {
    const { service, published } = setup();
    const folder = makeBuild('electron', 'src', 'out', 'Testing');
    const id = service.registerLocalBuild(folder);
    expect(service.registerLocalBuild(`${folder}${path.sep}`)).toBe(id);
    expect(published().at(-1)?.localBuilds).toEqual([
      { id, name: 'electron - Testing', path: folder, available: true },
    ]);
    expect(service.label({ kind: 'local', id })).toBe('electron - Testing');
    expect(service.label({ kind: 'local', id: 'gone' })).toBe('gone');
    expect(service.label({ kind: 'release', version: '30.0.0' })).toBe('30.0.0');
  });

  it('reports a build whose binary has gone as unavailable', () => {
    const { service } = setup();
    const folder = makeBuild('electron', 'src', 'out', 'Testing');
    const id = service.registerLocalBuild(folder);
    fs.rmSync(folder, { recursive: true, force: true });
    expect(service.localBuild(id)).toMatchObject({ available: false });
  });

  it('adds the folder the user picks, and refuses one without an Electron binary', async () => {
    const { service } = setup();
    dialogs.pickFolder.mockResolvedValueOnce(undefined);
    expect(await service.addLocalBuild('w')).toBeUndefined();

    const empty = path.join(dir, 'empty');
    fs.mkdirSync(empty);
    dialogs.pickFolder.mockResolvedValueOnce(empty);
    expect(await service.addLocalBuild('w')).toBeUndefined();
    expect(dialogs.messageBox).toHaveBeenCalledWith(
      'w',
      expect.objectContaining({ type: 'error', message: 'noBinaryTitle' }),
    );
    expect(service.localBuilds()).toEqual([]);

    const folder = makeBuild('electron', 'src', 'out', 'Release');
    dialogs.pickFolder.mockResolvedValueOnce(folder);
    const id = await service.addLocalBuild('w');
    expect(service.localBuild(id!)).toMatchObject({ path: folder, available: true });
  });

  it('offers to switch to a folder that is already registered instead of adding it twice', async () => {
    const { service } = setup();
    const folder = makeBuild('electron', 'src', 'out', 'Testing');
    const id = service.registerLocalBuild(folder);
    dialogs.pickFolder.mockResolvedValue(folder);

    dialogs.confirm.mockResolvedValueOnce(true);
    expect(await service.addLocalBuild('w')).toBe(id);
    expect(dialogs.confirm).toHaveBeenCalledWith(
      'w',
      expect.objectContaining({ message: 'switchToBuild:{"name":"electron - Testing"}' }),
    );
    dialogs.confirm.mockResolvedValueOnce(false);
    expect(await service.addLocalBuild('w')).toBeUndefined();
    expect(service.localBuilds()).toHaveLength(1);
  });

  it('refuses to remove a build a window uses, naming it, and removes the others', () => {
    const { service, activeBuilds, published } = setup();
    const used = service.registerLocalBuild(makeBuild('a', 'src', 'out', 'Testing'));
    const other = service.registerLocalBuild(makeBuild('b', 'src', 'out', 'Release'));
    activeBuilds.add(used);
    expect(() => service.removeLocalBuild(used)).toThrow(
      expect.objectContaining({
        code: ErrorCode.conflict,
        message: 'cannotRemoveActive:{"version":"a - Testing"}',
      }),
    );
    service.removeLocalBuild(other);
    expect(
      published()
        .at(-1)
        ?.localBuilds.map((b) => b.id),
    ).toEqual([used]);
  });

  it('keeps only the builds in use when everything is deleted', async () => {
    const { service, activeBuilds } = setup();
    const used = service.registerLocalBuild(makeBuild('a', 'src', 'out', 'Testing'));
    service.registerLocalBuild(makeBuild('b', 'src', 'out', 'Release'));
    activeBuilds.add(used);
    await service.deleteAll();
    expect(service.localBuilds().map((b) => b.id)).toEqual([used]);
  });
});

describe('removing versions', () => {
  function installed(
    service: InstanceType<typeof VersionsService>,
    ...versions: string[]
  ) {
    for (const version of versions)
      service.installer.emit('state-changed', { version, state: InstallState.installed });
  }

  it('refuses a version that a window or a run uses', async () => {
    const { service, onRemoved } = setup({ active: ['30.0.0'] });
    vi.spyOn(service.installer, 'remove').mockResolvedValue();
    await expect(service.remove('30.0.0')).rejects.toMatchObject({
      code: ErrorCode.conflict,
    });
    expect(onRemoved).not.toHaveBeenCalled();
  });

  it('drops the version and its types when it is gone', async () => {
    const { service, onRemoved } = setup();
    vi.spyOn(service.installer, 'remove').mockResolvedValue();
    vi.spyOn(service.installer, 'state').mockReturnValue(InstallState.missing);
    await service.remove('30.0.0');
    expect(onRemoved).toHaveBeenCalledWith('30.0.0');
  });

  it('reports a version that could not be removed, and keeps its types', async () => {
    const { service, onRemoved } = setup();
    vi.spyOn(service.installer, 'remove').mockResolvedValue();
    vi.spyOn(service.installer, 'state').mockReturnValue(InstallState.installed);
    await expect(service.remove('30.0.0')).rejects.toMatchObject({
      code: ErrorCode.unavailable,
    });
    expect(onRemoved).not.toHaveBeenCalled();
  });

  it('deletes all but the versions in use, and drops the types of the ones it removed', async () => {
    const { service, onRemoved } = setup({ active: ['29.0.0'] });
    installed(service, '30.0.0', '29.0.0', '28.0.0');
    const remove = vi.spyOn(service.installer, 'remove').mockResolvedValue();
    vi.spyOn(service.installer, 'state').mockImplementation((version) =>
      version === '28.0.0' ? InstallState.installed : InstallState.missing,
    );
    await service.deleteAll();
    expect(remove.mock.calls.map(([version]) => version)).toEqual(['30.0.0', '28.0.0']);
    expect(onRemoved.mock.calls.map(([version]) => version)).toEqual(['30.0.0']);
  });
});
