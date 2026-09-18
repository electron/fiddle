import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { extract, type ExtractOptions } from '@electron-internal/extract-zip';
import envPaths from 'env-paths';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  ElectronVersions,
  InstallState,
  Installer,
  type InstallStateEvent,
  type InstallerOptions,
  isFiddleCoreError,
} from '../src/index.js';
import { safeHostname } from '../src/fs-util.js';

vi.mock('@electron-internal/extract-zip');

const actual = await vi.importActual<typeof import('@electron-internal/extract-zip')>(
  '@electron-internal/extract-zip',
);

const fixture = (name: string) => path.join(import.meta.dirname, 'fixtures', name);
const zipName = (version: string) =>
  `electron-v${version}-${process.platform}-${process.arch}.zip`;
const { missing, downloading, downloaded, installing, installed } = InstallState;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The pid of a process that has already exited. */
async function deadPid(): Promise<number> {
  const child = spawn(process.execPath, ['-e', '']);
  await new Promise((resolve) => child.once('exit', resolve));
  return child.pid!;
}

// A local mirror serving the fixture zips and a releases list.
let server: http.Server;
let mirror: string;
const hits: string[] = [];
let hangZip = false;
let onZipRequest: (() => void) | undefined;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const url = req.url ?? '';
    hits.push(url);
    if (url === '/releases.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([{ version: '0.30.0' }, { version: '13.1.7' }]));
      return;
    }
    const [, version, file] = /^\/v([^/]+)\/(.+)$/.exec(url) ?? [];
    if (file === 'SHASUMS256.txt') {
      fs.createReadStream(fixture('SHASUMS256.txt')).pipe(res);
      return;
    }
    const zip = version && fixture(`electron-v${version}.zip`);
    if (zip && file === zipName(version) && fs.existsSync(zip)) {
      onZipRequest?.();
      if (hangZip) {
        // start the download, then never finish it
        res.writeHead(200, { 'Content-Length': '100000' });
        res.write(Buffer.alloc(10));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/zip' });
      fs.createReadStream(zip).pipe(res);
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  mirror = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

describe('Installer and ElectronVersions options', () => {
  let tmpdir: string;
  let paths: {
    electronDownloads: string;
    electronInstall: string;
    electronVersions: string;
  };
  const zipHits = () => hits.filter((hit) => hit.endsWith('.zip'));

  beforeEach(async () => {
    vi.mocked(extract).mockImplementation((zipPath: string, opts: ExtractOptions) =>
      actual.extract(zipPath, opts),
    );
    tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fiddle-core-'));
    paths = {
      electronDownloads: path.join(tmpdir, 'downloads'),
      electronInstall: path.join(tmpdir, 'current'),
      electronVersions: path.join(tmpdir, 'versions'),
    };
    hits.length = 0;
    hangZip = false;
    onZipRequest = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  function createInstaller(options: InstallerOptions = {}) {
    return new Installer(paths, { mirror: { electronMirror: mirror }, ...options });
  }

  async function listenWhile(installer: Installer, func: () => Promise<unknown>) {
    const events: InstallStateEvent[] = [];
    const listener = (ev: InstallStateEvent) => events.push(ev);
    installer.on('state-changed', listener);
    try {
      await func();
    } finally {
      installer.removeListener('state-changed', listener);
    }
    return events;
  }

  const readVersion = (dir: string) =>
    fs.readFileSync(path.join(dir, 'version'), 'utf8').trim();
  const ls = (dir: string) => fs.readdirSync(dir).sort();
  const versionsDir = (...names: string[]) => path.join(paths.electronVersions, ...names);

  describe("the 'per-version' layout", () => {
    it('installs several versions side by side', async () => {
      const installer = createInstaller({ layout: 'per-version' });
      const exec13 = await installer.install('13.1.7');
      const exec12 = await installer.install('12.0.15');

      expect(exec13).toBe(Installer.getExecPath(versionsDir('13.1.7')));
      expect(exec12).toBe(Installer.getExecPath(versionsDir('12.0.15')));
      expect(readVersion(versionsDir('13.1.7'))).toBe('13.1.7');
      expect(readVersion(versionsDir('12.0.15'))).toBe('12.0.15');
      expect(installer.state('13.1.7')).toBe(installed);
      expect(installer.state('12.0.15')).toBe(installed);
      expect(installer.installedVersions.sort()).toStrictEqual(['12.0.15', '13.1.7']);

      // no temp folders or locks left behind, and the current folder is untouched
      expect(ls(paths.electronVersions)).toStrictEqual(['.locks', '12.0.15', '13.1.7']);
      expect(ls(versionsDir('.locks'))).toStrictEqual([]);
      expect(fs.existsSync(paths.electronInstall)).toBe(false);
    });

    it('emits the same state events as the current layout', async () => {
      const installer = createInstaller({ layout: 'per-version' });
      const version = '13.1.7';
      const events = await listenWhile(installer, () => installer.install(version));
      expect(events).toStrictEqual([
        { version, state: downloading },
        { version, state: downloaded },
        { version, state: installing },
        { version, state: installed },
      ]);
    });

    it('returns an installed version without touching the network', async () => {
      const installer = createInstaller({ layout: 'per-version' });
      await installer.install('13.1.7');
      hits.length = 0;

      const events = await listenWhile(installer, () => installer.install('13.1.7'));
      expect(events).toStrictEqual([]);
      expect(hits).toStrictEqual([]);
    });

    it('shares one install, and its progress, between concurrent calls', async () => {
      const installer = createInstaller({ layout: 'per-version' });
      const progressA = vi.fn();
      const progressB = vi.fn();
      const [a, b] = await Promise.all([
        installer.install('13.1.7', { progressCallback: progressA }),
        installer.install('13.1.7', { progressCallback: progressB }),
      ]);
      expect(a).toBe(b);
      expect(zipHits()).toHaveLength(1);
      expect(progressA).toHaveBeenCalled();
      expect(progressB).toHaveBeenCalled();
    });

    it('finds installed versions when constructed', async () => {
      await createInstaller({ layout: 'per-version' }).install('13.1.7');
      const fresh = createInstaller({ layout: 'per-version' });
      expect(fresh.state('13.1.7')).toBe(installed);
      expect(fresh.installedVersions).toStrictEqual(['13.1.7']);
    });

    it('counts only folders that hold an executable, never lock files', async () => {
      fs.mkdirSync(versionsDir('.locks'), { recursive: true });
      fs.writeFileSync(versionsDir('13.0.0-beta.1.lock'), '{}');
      fs.writeFileSync(versionsDir('.locks', '13.0.0-beta.1.lock'), '{}');
      fs.mkdirSync(versionsDir('12.0.15'));
      const exec = Installer.getExecPath(versionsDir('13.1.7'));
      fs.mkdirSync(path.dirname(exec), { recursive: true });
      fs.writeFileSync(exec, '');

      const installer = createInstaller({ layout: 'per-version' });
      expect(installer.installedVersions).toStrictEqual(['13.1.7']);
      expect(installer.state('13.0.0-beta.1')).toBe(missing);
      expect(installer.state('12.0.15')).toBe(missing);
    });

    it('replaces a folder that has no executable', async () => {
      fs.mkdirSync(versionsDir('13.1.7'), { recursive: true });
      fs.writeFileSync(versionsDir('13.1.7', 'junk'), '');

      const exec = await createInstaller({ layout: 'per-version' }).install('13.1.7');
      expect(fs.existsSync(exec)).toBe(true);
      expect(fs.existsSync(versionsDir('13.1.7', 'junk'))).toBe(false);
      expect(ls(paths.electronVersions)).toStrictEqual(['.locks', '13.1.7']);
    });

    it('leaves nothing behind when extraction fails', async () => {
      vi.mocked(extract).mockImplementation(
        async (_zip: string, { dir }: ExtractOptions) => {
          fs.writeFileSync(path.join(dir, 'partial'), '');
          throw new Error('disk full');
        },
      );
      const installer = createInstaller({ layout: 'per-version', errors: 'typed' });

      const err: unknown = await installer.install('13.1.7').catch((e: unknown) => e);
      expect(isFiddleCoreError(err, 'extract-failed')).toBe(true);
      expect((err as Error).cause).toEqual(new Error('disk full'));
      expect(ls(paths.electronVersions)).toStrictEqual(['.locks']);
      expect(installer.state('13.1.7')).toBe(downloaded);
    });

    it('sweeps temp and trash folders left by dead or long-gone processes', async () => {
      const host = safeHostname();
      const dead = await deadPid();
      const old = new Date(Date.now() - 60 * 60 * 1000);
      const leftovers = {
        deadTmp: `.tmp-13.1.7_${host}_${dead}_abc123`,
        deadTrash: `.rm-12.0.15_${host}_${dead}_deadbeef`,
        liveTmp: `.tmp-12.0.15_${host}_${process.pid}_live01`,
        oldRemote: `.tmp-13.1.7_other-host_1_old001`,
        freshRemote: `.rm-13.1.7_other-host_1_new001`,
      };
      for (const name of Object.values(leftovers)) {
        fs.mkdirSync(versionsDir(name), { recursive: true });
        fs.writeFileSync(versionsDir(name, 'file'), '');
      }
      fs.utimesSync(versionsDir(leftovers.oldRemote), old, old);

      await createInstaller({ layout: 'per-version' }).install('13.1.7');
      expect(ls(paths.electronVersions)).toStrictEqual(
        ['.locks', leftovers.liveTmp, leftovers.freshRemote, '13.1.7'].sort(),
      );
    });

    it('removes an installed version', async () => {
      const installer = createInstaller({ layout: 'per-version' });
      await installer.install('13.1.7');
      await installer.install('12.0.15');

      await installer.remove('13.1.7');
      expect(installer.state('13.1.7')).toBe(missing);
      expect(installer.state('12.0.15')).toBe(installed);
      expect(ls(paths.electronVersions)).toStrictEqual(['.locks', '12.0.15']);
    });

    it('keeps what is left in the state when a removal fails', async () => {
      const installer = createInstaller({ layout: 'per-version' });
      await installer.install('13.1.7');
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const rm = fs.promises.rm.bind(fs.promises);
      vi.spyOn(fs.promises, 'rm').mockImplementation(((target: string, ...rest: []) =>
        target.endsWith('.zip')
          ? Promise.reject(new Error('busy'))
          : rm(target, ...rest)) as never);

      await installer.remove('13.1.7');
      expect(warn).toHaveBeenCalled();
      expect(fs.existsSync(versionsDir('13.1.7'))).toBe(false);
      expect(fs.existsSync(path.join(paths.electronDownloads, zipName('13.1.7')))).toBe(
        true,
      );
      expect(installer.state('13.1.7')).toBe(downloaded);
    });

    it('leaves the Electron download cache shared with other tools alone', async () => {
      const cache = envPaths('electron', { suffix: '' }).cache;
      const key = createHash('sha256').update(`${mirror}v13.1.7`).digest('hex');
      const cached = path.join(cache, key, zipName('13.1.7'));
      fs.rmSync(path.dirname(cached), { recursive: true, force: true });
      fs.mkdirSync(path.dirname(cached), { recursive: true });
      fs.copyFileSync(fixture('electron-v13.1.7.zip'), cached);
      const tempDirs: string[] = [];
      const mkdtemp = fs.promises.mkdtemp.bind(fs.promises);
      vi.spyOn(fs.promises, 'mkdtemp').mockImplementation(((prefix: string) =>
        mkdtemp(prefix).then((dir) => {
          if (path.basename(prefix) === 'electron-download-') tempDirs.push(dir);
          return dir;
        })) as never);

      try {
        await createInstaller({ layout: 'per-version' }).install('13.1.7');
        expect(fs.existsSync(cached)).toBe(true);
        expect(zipHits()).toHaveLength(1);
        expect(tempDirs.length).toBeGreaterThan(0);
        for (const dir of tempDirs) expect(fs.existsSync(dir)).toBe(false);
      } finally {
        fs.rmSync(path.dirname(cached), { recursive: true, force: true });
      }
    });

    it('never turns off asar support for the whole process', async () => {
      const writes: unknown[] = [];
      Object.defineProperty(process, 'noAsar', {
        configurable: true,
        get: () => undefined,
        set: (value) => writes.push(value),
      });
      try {
        for (const layout of ['current', 'per-version'] as const) {
          const installer = createInstaller({ layout });
          await installer.install('13.1.7');
          await installer.remove('13.1.7');
        }
      } finally {
        delete (process as { noAsar?: boolean }).noAsar;
      }
      expect(writes).toStrictEqual([]);
    });

    it('is not left installing when the temp folder cannot be created', async () => {
      const mkdtemp = fs.promises.mkdtemp.bind(fs.promises);
      vi.spyOn(fs.promises, 'mkdtemp').mockImplementation(((prefix: string) =>
        path.basename(prefix).startsWith('.tmp-')
          ? Promise.reject(new Error('no space left on device'))
          : mkdtemp(prefix)) as never);
      const installer = createInstaller({ layout: 'per-version' });

      await expect(installer.install('13.1.7')).rejects.toThrow('no space left');
      expect(installer.state('13.1.7')).toBe(downloaded);
    });

    it('defaults electronVersions to a folder next to electronInstall', async () => {
      const installer = new Installer(
        {
          electronDownloads: paths.electronDownloads,
          electronInstall: paths.electronInstall,
        },
        { layout: 'per-version', mirror: { electronMirror: mirror } },
      );
      const exec = await installer.install('13.1.7');
      expect(exec).toBe(Installer.getExecPath(path.join(tmpdir, 'versions', '13.1.7')));
    });

    it('extracts through the `extract` option, without touching process.noAsar', async () => {
      const noAsar: unknown[] = [];
      const custom = vi.fn(
        async (zipPath: string, dir: string, _signal?: AbortSignal) => {
          noAsar.push(process.noAsar);
          await actual.extract(zipPath, { dir });
        },
      );
      const installer = createInstaller({ layout: 'per-version', extract: custom });

      const exec = await installer.install('13.1.7');
      expect(fs.existsSync(exec)).toBe(true);
      expect(custom).toHaveBeenCalledWith(
        path.join(paths.electronDownloads, zipName('13.1.7')),
        expect.stringContaining(versionsDir(`.tmp-13.1.7_`)),
        expect.any(AbortSignal),
      );
      expect(noAsar).toStrictEqual([undefined]);
      expect(extract).not.toHaveBeenCalled();
    });
  });

  describe('sharing a cache between installers', () => {
    const options = { layout: 'per-version' } as const;

    it('lets two installers share one cache folder', async () => {
      const a = createInstaller(options);
      const b = createInstaller(options);

      const [execA, execB] = await Promise.all([
        a.install('13.1.7'),
        b.install('13.1.7'),
      ]);
      expect(execA).toBe(execB);
      expect(a.state('13.1.7')).toBe(installed);
      expect(b.state('13.1.7')).toBe(installed);
      expect(zipHits()).toHaveLength(1);
      expect(readVersion(versionsDir('13.1.7'))).toBe('13.1.7');

      // locks are released and removed
      expect(ls(paths.electronVersions)).toStrictEqual(['.locks', '13.1.7']);
      expect(ls(versionsDir('.locks'))).toStrictEqual([]);
      expect(ls(paths.electronDownloads)).toStrictEqual(['.locks', zipName('13.1.7')]);
      expect(ls(path.join(paths.electronDownloads, '.locks'))).toStrictEqual([]);
    });

    it('lets two installers install different versions at once', async () => {
      await Promise.all([
        createInstaller(options).install('13.1.7'),
        createInstaller(options).install('12.0.15'),
      ]);
      expect(ls(paths.electronVersions)).toStrictEqual(['.locks', '12.0.15', '13.1.7']);
    });

    it('serializes installs of one version: at most one extract at a time', async () => {
      let running = 0;
      let most = 0;
      vi.mocked(extract).mockImplementation(async (zipPath, opts) => {
        most = Math.max(most, ++running);
        await sleep(50);
        await actual.extract(zipPath, opts);
        running--;
      });

      const installers = [1, 2, 3].map(() => createInstaller(options));
      await Promise.all(installers.map((installer) => installer.install('13.1.7')));
      expect(most).toBe(1);
      expect(extract).toHaveBeenCalledTimes(1);
      for (const installer of installers) {
        expect(installer.state('13.1.7')).toBe(installed);
      }
    });

    it('takes the install lock only after the download finishes', async () => {
      const locks: { download: boolean; install: boolean }[] = [];
      onZipRequest = () =>
        locks.push({
          download: fs.existsSync(
            path.join(paths.electronDownloads, '.locks', `${zipName('13.1.7')}.lock`),
          ),
          install: fs.existsSync(versionsDir('.locks', '13.1.7.lock')),
        });
      await createInstaller(options).install('13.1.7');
      expect(locks).toStrictEqual([{ download: true, install: false }]);
    });

    it('recovers an install lock left behind by a crashed process', async () => {
      fs.mkdirSync(versionsDir('.locks'), { recursive: true });
      const lockInfo = { pid: await deadPid(), hostname: os.hostname(), startedAt: 0 };
      fs.writeFileSync(versionsDir('.locks', '13.1.7.lock'), JSON.stringify(lockInfo));

      const installer = createInstaller(options);
      await installer.install('13.1.7');
      expect(installer.state('13.1.7')).toBe(installed);
      expect(ls(paths.electronVersions)).toStrictEqual(['.locks', '13.1.7']);
      expect(ls(versionsDir('.locks'))).toStrictEqual([]);
    });

    it('accepts the deprecated `locks` option and ignores it', async () => {
      await createInstaller({ locks: true }).install('13.1.7');
      expect(readVersion(paths.electronInstall)).toBe('13.1.7');
      expect(fs.existsSync(path.join(paths.electronDownloads, '.locks'))).toBe(false);
      expect(fs.existsSync(paths.electronVersions)).toBe(false);
    });
  });

  describe('cancellation', () => {
    it('rejects at once when the signal is already aborted', async () => {
      const installer = createInstaller();
      const install = installer.install('13.1.7', { signal: AbortSignal.abort() });
      await expect(install).rejects.toHaveProperty('code', 'aborted');
      expect(hits).toStrictEqual([]);
      expect(installer.state('13.1.7')).toBe(missing);
    });

    it('cancels a download in flight', async () => {
      hangZip = true;
      const controller = new AbortController();
      onZipRequest = () => controller.abort();
      const installer = createInstaller({ layout: 'per-version' });

      const install = installer.install('13.1.7', { signal: controller.signal });
      await expect(install).rejects.toHaveProperty('code', 'aborted');
      // the caller stops waiting at once; the download then cleans up
      await expect.poll(() => installer.state('13.1.7')).toBe(missing);
      expect(ls(paths.electronDownloads)).toStrictEqual(['.locks']);
      expect(fs.existsSync(versionsDir('13.1.7'))).toBe(false);
    });

    it('cancels ensureDownloaded() too', async () => {
      const installer = createInstaller();
      const download = installer.ensureDownloaded('13.1.7', {
        signal: AbortSignal.abort(),
      });
      await expect(download).rejects.toHaveProperty('code', 'aborted');
    });

    it('stops waiting for a lock', async () => {
      const options = { layout: 'per-version' } as const;
      hangZip = true;
      const holder = createInstaller(options);
      const holderController = new AbortController();
      const started = new Promise<void>((resolve) => (onZipRequest = resolve));
      const held = holder.install('13.1.7', { signal: holderController.signal });
      await started;

      const waiter = createInstaller(options);
      const install = waiter.install('13.1.7', { signal: AbortSignal.timeout(200) });
      await expect(install).rejects.toHaveProperty('code', 'aborted');

      holderController.abort();
      await expect(held).rejects.toHaveProperty('code', 'aborted');
    });

    it('checks the signal in the extract step', async () => {
      const controller = new AbortController();
      const installer = createInstaller({
        layout: 'per-version',
        extract: async (zipPath, dir) => {
          controller.abort();
          await actual.extract(zipPath, { dir });
        },
      });

      const install = installer.install('13.1.7', { signal: controller.signal });
      await expect(install).rejects.toHaveProperty('code', 'aborted');
      // let the shared install notice the abort and clean up
      await expect.poll(() => installer.state('13.1.7')).toBe(downloaded);
      expect(ls(paths.electronVersions)).toStrictEqual(['.locks']);
    });

    describe('with concurrent calls', () => {
      const options = { layout: 'per-version' } as const;

      it('keeps the shared install going while any caller still waits', async () => {
        const installer = createInstaller(options);
        const a = new AbortController();
        const b = new AbortController();
        onZipRequest = () => a.abort();

        const [resultA, resultB] = await Promise.allSettled([
          installer.install('13.1.7', { signal: a.signal }),
          installer.install('13.1.7', { signal: b.signal }),
        ]);
        expect(resultA).toMatchObject({
          status: 'rejected',
          reason: { code: 'aborted' },
        });
        expect(resultB).toStrictEqual({
          status: 'fulfilled',
          value: Installer.getExecPath(versionsDir('13.1.7')),
        });
        expect(zipHits()).toHaveLength(1);
        expect(installer.state('13.1.7')).toBe(installed);
      });

      it('keeps the shared install going for a caller without a signal', async () => {
        const installer = createInstaller(options);
        const a = new AbortController();
        onZipRequest = () => a.abort();

        const [resultA, resultB] = await Promise.allSettled([
          installer.install('13.1.7', { signal: a.signal }),
          installer.install('13.1.7'),
        ]);
        expect(resultA).toMatchObject({
          status: 'rejected',
          reason: { code: 'aborted' },
        });
        expect(resultB.status).toBe('fulfilled');
      });

      it('stops the shared download once every caller has aborted', async () => {
        hangZip = true;
        const installer = createInstaller(options);
        const a = new AbortController();
        const b = new AbortController();
        onZipRequest = () => {
          a.abort();
          b.abort();
        };

        const results = await Promise.allSettled([
          installer.install('13.1.7', { signal: a.signal }),
          installer.install('13.1.7', { signal: b.signal }),
        ]);
        for (const result of results) {
          expect(result).toMatchObject({
            status: 'rejected',
            reason: { code: 'aborted' },
          });
        }
        await expect.poll(() => installer.state('13.1.7')).toBe(missing);
        expect(ls(paths.electronDownloads)).toStrictEqual(['.locks']);

        // a later call starts afresh instead of joining the stopped one
        hangZip = false;
        onZipRequest = undefined;
        await expect(installer.install('13.1.7')).resolves.toBe(
          Installer.getExecPath(versionsDir('13.1.7')),
        );
      });
    });
  });

  describe('injectable endpoints', () => {
    it('lets a call override the mirror given to the constructor', async () => {
      const installer = new Installer(paths, {
        mirror: { electronMirror: 'http://127.0.0.1:1/' },
      });
      await installer.ensureDownloaded('13.1.7', {
        mirror: { electronMirror: mirror, electronNightlyMirror: mirror },
      });
      expect(zipHits()).toStrictEqual([`/v13.1.7/${zipName('13.1.7')}`]);
    });

    describe('mirror environment variables', () => {
      const names = [
        'ELECTRON_MIRROR',
        'ELECTRON_CUSTOM_DIR',
        'ELECTRON_CUSTOM_FILENAME',
      ];
      const saved = names.map((name) => process.env[name]);
      beforeEach(() => {
        process.env.ELECTRON_MIRROR = 'http://127.0.0.1:1/';
        process.env.ELECTRON_CUSTOM_DIR = 'env-dir';
        process.env.ELECTRON_CUSTOM_FILENAME = 'env-file.zip';
      });
      afterEach(() => {
        names.forEach((name, i) => {
          if (saved[i] === undefined) delete process.env[name];
          else process.env[name] = saved[i];
        });
      });

      it('take precedence over the mirror by default', async () => {
        const installer = new Installer(paths, { mirror: { electronMirror: mirror } });
        await expect(installer.ensureDownloaded('13.1.7')).rejects.toThrow();
        expect(hits).toStrictEqual([]);
      });

      it('are ignored with `override`, for the zip and its checksums', async () => {
        const installer = new Installer(paths, {
          mirror: {
            electronMirror: mirror,
            electronNightlyMirror: mirror,
            override: true,
          },
        });
        await installer.ensureDownloaded('13.1.7');
        expect(hits).toStrictEqual([
          `/v13.1.7/${zipName('13.1.7')}`,
          '/v13.1.7/SHASUMS256.txt',
        ]);
      });
    });

    it('fetches the releases list from releasesUrl', async () => {
      const versionsCache = path.join(tmpdir, 'releases.json');
      const versions = await ElectronVersions.create({
        paths: { versionsCache },
        releasesUrl: `${mirror}releases.json`,
      });
      expect(hits).toStrictEqual(['/releases.json']);
      expect(versions.versions.map(({ version }) => version)).toStrictEqual([
        '0.30.0',
        '13.1.7',
      ]);
      expect(JSON.parse(fs.readFileSync(versionsCache, 'utf8'))).toHaveLength(2);
    });
  });

  describe('errors', () => {
    it("uses `download-failed` for a failed download with errors: 'typed'", async () => {
      const installer = createInstaller({ errors: 'typed' });
      const err: unknown = await installer.ensureDownloaded('99.0.0').catch((e) => e);
      expect(isFiddleCoreError(err, 'download-failed')).toBe(true);
      expect((err as Error).cause).toBeInstanceOf(Error);
      expect(installer.state('99.0.0')).toBe(missing);
    });

    it('throws the original download error by default', async () => {
      const installer = createInstaller();
      const err: unknown = await installer.ensureDownloaded('99.0.0').catch((e) => e);
      expect(err).toBeInstanceOf(Error);
      expect(isFiddleCoreError(err)).toBe(false);
    });

    it('uses `download-failed` when the releases list cannot be fetched', async () => {
      const create = ElectronVersions.create({
        paths: { versionsCache: path.join(tmpdir, 'releases.json') },
        releasesUrl: `${mirror}missing.json`,
      });
      await expect(create).rejects.toHaveProperty('code', 'download-failed');
    });

    it("wraps a network error from the releases fetch only with errors: 'typed'", async () => {
      const options = {
        paths: { versionsCache: path.join(tmpdir, 'releases.json') },
        releasesUrl: 'http://127.0.0.1:1/releases.json',
      };
      const legacy: unknown = await ElectronVersions.create(options).catch((e) => e);
      expect(legacy).toBeInstanceOf(TypeError);

      const typed: unknown = await ElectronVersions.create({
        ...options,
        errors: 'typed',
      }).catch((e) => e);
      expect(isFiddleCoreError(typed, 'download-failed')).toBe(true);
      expect((typed as Error).cause).toBeInstanceOf(TypeError);
    });

    it.each(['../x', 'v13.1.7', ' 13.1.7', '=13.1.7'])(
      'uses `invalid-version` for the bad version "%s"',
      async (version) => {
        const installer = createInstaller({ layout: 'per-version' });
        await expect(installer.install(version)).rejects.toHaveProperty(
          'code',
          'invalid-version',
        );
        expect(hits).toStrictEqual([]);
      },
    );

    it('uses `already-installing` for a duplicate install into the current folder', async () => {
      const installer = createInstaller();
      const first = installer.install('13.1.7');
      await expect(installer.install('13.1.7')).rejects.toHaveProperty(
        'code',
        'already-installing',
      );
      await first;
    });

    it('still compares equal to a plain Error with the same message', async () => {
      const installer = createInstaller();
      await expect(installer.ensureDownloaded('x')).rejects.toEqual(
        new Error('Invalid Electron version: "x"'),
      );
    });
  });

  describe("the 'current' layout", () => {
    it('does not report the previous version as installed when replacing it fails', async () => {
      const installer = createInstaller();
      await installer.install('12.0.15');
      vi.mocked(extract).mockRejectedValueOnce(new Error('disk full'));

      await expect(installer.install('13.1.7')).rejects.toThrow('disk full');
      expect(installer.installedVersion).toBe(undefined);
      expect(installer.state('12.0.15')).toBe(downloaded);
      expect(installer.state('13.1.7')).toBe(downloaded);

      const exec = await installer.install('12.0.15');
      expect(fs.existsSync(exec)).toBe(true);
      expect(installer.installedVersions).toStrictEqual(['12.0.15']);
    });

    it('installs one version at a time, since they share a folder', async () => {
      const installer = createInstaller();
      const first = installer.install('12.0.15');
      await expect(installer.install('13.1.7')).rejects.toHaveProperty(
        'code',
        'already-installing',
      );
      await first;
      expect(readVersion(paths.electronInstall)).toBe('12.0.15');
      expect(installer.installedVersions).toStrictEqual(['12.0.15']);
    });

    it('still reports the current install after a restart', async () => {
      await createInstaller().install('13.1.7');
      const fresh = createInstaller();
      expect(fresh.state('13.1.7')).toBe(installed);
      expect(fresh.installedVersion).toBe('13.1.7');
    });

    it('treats a current folder without the completion marker as downloaded', async () => {
      await createInstaller().install('13.1.7');
      const marker = path.join(paths.electronInstall, '.fiddle-core-installed');
      expect(fs.existsSync(marker)).toBe(true);
      fs.rmSync(marker);

      const fresh = createInstaller();
      expect(fresh.state('13.1.7')).toBe(downloaded);
      expect(fresh.installedVersion).toBe(undefined);

      const events = await listenWhile(fresh, () => fresh.install('13.1.7'));
      expect(events).toStrictEqual([
        { version: '13.1.7', state: installing },
        { version: '13.1.7', state: installed },
      ]);
      expect(fs.existsSync(marker)).toBe(true);
    });
  });
});
