import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { extract, type ExtractOptions } from '@electron-internal/extract-zip';
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

vi.mock('@electron-internal/extract-zip');

const actual = await vi.importActual<typeof import('@electron-internal/extract-zip')>(
  '@electron-internal/extract-zip',
);

const fixture = (name: string) => path.join(import.meta.dirname, 'fixtures', name);
const zipName = (version: string) =>
  `electron-v${version}-${process.platform}-${process.arch}.zip`;
const { missing, downloading, downloaded, installing, installed } = InstallState;

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

describe('fiddle-core 3.0 additions', () => {
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

  describe("the 'per-version' layout", () => {
    it('installs several versions side by side', async () => {
      const installer = createInstaller({ layout: 'per-version' });
      const exec13 = await installer.install('13.1.7');
      const exec12 = await installer.install('12.0.15');

      const dir13 = path.join(paths.electronVersions, '13.1.7');
      const dir12 = path.join(paths.electronVersions, '12.0.15');
      expect(exec13).toBe(Installer.getExecPath(dir13));
      expect(exec12).toBe(Installer.getExecPath(dir12));
      expect(readVersion(dir13)).toBe('13.1.7');
      expect(readVersion(dir12)).toBe('12.0.15');
      expect(installer.state('13.1.7')).toBe(installed);
      expect(installer.state('12.0.15')).toBe(installed);
      expect(installer.installedVersions.sort()).toStrictEqual(['12.0.15', '13.1.7']);

      // no temp folders or locks left behind, and the current folder is untouched
      expect(fs.readdirSync(paths.electronVersions).sort()).toStrictEqual([
        '12.0.15',
        '13.1.7',
      ]);
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

    it('shares one install between concurrent calls', async () => {
      const installer = createInstaller({ layout: 'per-version' });
      const [a, b] = await Promise.all([
        installer.install('13.1.7'),
        installer.install('13.1.7'),
      ]);
      expect(a).toBe(b);
      expect(zipHits()).toHaveLength(1);
    });

    it('finds installed versions when constructed', async () => {
      await createInstaller({ layout: 'per-version' }).install('13.1.7');
      const fresh = createInstaller({ layout: 'per-version' });
      expect(fresh.state('13.1.7')).toBe(installed);
      expect(fresh.installedVersions).toStrictEqual(['13.1.7']);
    });

    it('leaves nothing behind when extraction fails', async () => {
      vi.mocked(extract).mockImplementation(
        async (_zip: string, { dir }: ExtractOptions) => {
          fs.writeFileSync(path.join(dir, 'partial'), '');
          throw new Error('disk full');
        },
      );
      const installer = createInstaller({ layout: 'per-version' });

      const err: unknown = await installer.install('13.1.7').catch((e: unknown) => e);
      expect(isFiddleCoreError(err, 'extract-failed')).toBe(true);
      expect(fs.readdirSync(paths.electronVersions)).toStrictEqual([]);
      expect(installer.state('13.1.7')).toBe(downloaded);
    });

    it('removes an installed version', async () => {
      const installer = createInstaller({ layout: 'per-version' });
      await installer.install('13.1.7');
      await installer.install('12.0.15');

      await installer.remove('13.1.7');
      expect(installer.state('13.1.7')).toBe(missing);
      expect(installer.state('12.0.15')).toBe(installed);
      expect(fs.readdirSync(paths.electronVersions)).toStrictEqual(['12.0.15']);
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
  });

  describe('cross-process locks', () => {
    it('lets two installers share one cache folder', async () => {
      const options = { layout: 'per-version', locks: true } as const;
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
      expect(readVersion(path.join(paths.electronVersions, '13.1.7'))).toBe('13.1.7');

      // locks are released and removed
      expect(fs.readdirSync(paths.electronVersions)).toStrictEqual(['13.1.7']);
      expect(fs.readdirSync(paths.electronDownloads)).toStrictEqual([zipName('13.1.7')]);
    });

    it('lets two installers install different versions at once', async () => {
      const options = { layout: 'per-version', locks: true } as const;
      await Promise.all([
        createInstaller(options).install('13.1.7'),
        createInstaller(options).install('12.0.15'),
      ]);
      expect(fs.readdirSync(paths.electronVersions).sort()).toStrictEqual([
        '12.0.15',
        '13.1.7',
      ]);
    });

    it('serializes installs into the current folder', async () => {
      const a = createInstaller({ locks: true });
      const b = createInstaller({ locks: true });
      await Promise.all([a.install('13.1.7'), b.install('12.0.15')]);

      expect(['13.1.7', '12.0.15']).toContain(readVersion(paths.electronInstall));
      expect(
        fs.readdirSync(tmpdir).filter((name) => name.endsWith('.lock')),
      ).toStrictEqual([]);
    });

    it('recovers an install lock left behind by a crashed process', async () => {
      const child = spawn(process.execPath, ['-e', '']);
      await new Promise((resolve) => child.once('exit', resolve));
      fs.mkdirSync(paths.electronVersions, { recursive: true });
      const lockInfo = { pid: child.pid, hostname: os.hostname(), startedAt: Date.now() };
      fs.writeFileSync(
        path.join(paths.electronVersions, '13.1.7.lock'),
        JSON.stringify(lockInfo),
      );

      const installer = createInstaller({ layout: 'per-version', locks: true });
      await installer.install('13.1.7');
      expect(installer.state('13.1.7')).toBe(installed);
      expect(fs.readdirSync(paths.electronVersions)).toStrictEqual(['13.1.7']);
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
      const installer = createInstaller({ layout: 'per-version', locks: true });

      const install = installer.install('13.1.7', { signal: controller.signal });
      await expect(install).rejects.toHaveProperty('code', 'aborted');
      expect(installer.state('13.1.7')).toBe(missing);
      expect(fs.existsSync(path.join(paths.electronDownloads, zipName('13.1.7')))).toBe(
        false,
      );
      expect(fs.readdirSync(paths.electronDownloads)).toStrictEqual([]);
      expect(fs.existsSync(path.join(paths.electronVersions, '13.1.7'))).toBe(false);
    });

    it('cancels ensureDownloaded() too', async () => {
      const installer = createInstaller();
      const download = installer.ensureDownloaded('13.1.7', {
        signal: AbortSignal.abort(),
      });
      await expect(download).rejects.toHaveProperty('code', 'aborted');
    });

    it('stops waiting for a lock', async () => {
      const options = { layout: 'per-version', locks: true } as const;
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

  describe('typed errors', () => {
    it('uses `download-failed` when a release cannot be downloaded', async () => {
      const installer = createInstaller();
      await expect(installer.ensureDownloaded('99.0.0')).rejects.toHaveProperty(
        'code',
        'download-failed',
      );
      expect(installer.state('99.0.0')).toBe(missing);
    });

    it('uses `download-failed` when the releases list cannot be fetched', async () => {
      const create = ElectronVersions.create({
        paths: { versionsCache: path.join(tmpdir, 'releases.json') },
        releasesUrl: `${mirror}missing.json`,
      });
      await expect(create).rejects.toHaveProperty('code', 'download-failed');
    });

    it('uses `invalid-version` for a bad version', async () => {
      const installer = createInstaller({ layout: 'per-version' });
      await expect(installer.install('../x')).rejects.toHaveProperty(
        'code',
        'invalid-version',
      );
    });

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

  it('still reports the current install after a restart', async () => {
    await createInstaller().install('13.1.7');
    const fresh = createInstaller();
    expect(fresh.state('13.1.7')).toBe(installed);
    expect(fresh.installedVersion).toBe('13.1.7');
  });
});
