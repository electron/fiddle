import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { extract, type ExtractOptions } from '@electron-internal/extract-zip';
import nock, { type Scope } from 'nock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type ElectronBinary,
  type InstallStateEvent,
  Installer,
  type Paths,
  InstallState,
} from '../src/index.js';

vi.mock('@electron-internal/extract-zip');

const { extract: extractZip } = await vi.importActual<
  typeof import('@electron-internal/extract-zip')
>('@electron-internal/extract-zip');

describe('Installer', () => {
  let tmpdir: string;
  let paths: Pick<Paths, 'electronDownloads' | 'electronInstall'>;
  let nockScope: Scope;
  let installer: Installer;
  const { missing, downloading, downloaded, installing, installed } = InstallState;
  const version12 = '12.0.15' as const;
  const version13 = '13.1.7' as const;
  const version = version13;
  const fixture = (name: string) => path.join(import.meta.dirname, 'fixtures', name);

  beforeEach(async () => {
    vi.mocked(extract).mockImplementation(
      async (zipPath: string, opts: ExtractOptions) => {
        await extractZip(zipPath, opts);
      },
    );
    tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fiddle-core-'));
    paths = {
      electronDownloads: path.join(tmpdir, 'downloads'),
      electronInstall: path.join(tmpdir, 'install'),
    };
    installer = new Installer(paths);

    nock.disableNetConnect();
    nockScope = nock('https://github.com:443');
    nockScope
      .persist()
      .get(/electron-v13.1.7-.*\.zip$/)
      .replyWithFile(200, fixture('electron-v13.1.7.zip'), {
        'Content-Type': 'application/zip',
      })
      .get(/electron-v12.0.15-.*\.zip$/)
      .replyWithFile(200, fixture('electron-v12.0.15.zip'), {
        'Content-Type': 'application/zip',
      })
      .get(/SHASUMS256\.txt$/)
      .replyWithFile(200, fixture('SHASUMS256.txt'), {
        'Content-Type': 'text/plain;charset=UTF-8',
      });
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  // test helpers

  async function listenWhile(installer: Installer, func: () => Promise<unknown>) {
    const events: InstallStateEvent[] = [];
    const listener = (ev: InstallStateEvent) => events.push(ev);
    const event = 'state-changed';
    installer.on(event, listener);
    const result = await func();
    installer.removeListener(event, listener);
    return { events, result };
  }

  async function doRemove(installer: Installer, version: string) {
    const func = () => installer.remove(version);
    const { events } = await listenWhile(installer, func);

    expect(installer.state(version)).toBe(missing);

    return { events };
  }

  async function doInstall(installer: Installer, version: string) {
    let isDownloaded = false;
    const progressCallback = () => {
      isDownloaded = true;
    };

    // Version is already downloaded and present in local
    if (installer.state(version) !== missing) {
      isDownloaded = true;
    }
    const func = () => installer.install(version, { progressCallback });
    const { events, result } = await listenWhile(installer, func);
    const exec = result as string;

    const installedVersion = fs
      .readFileSync(path.join(paths.electronInstall, 'version'), 'utf-8')
      .trim();

    expect(isDownloaded).toBe(true);
    expect(installer.state(version)).toBe(installed);
    expect(installer.installedVersion).toBe(version);
    expect(installedVersion).toBe(version);

    return { events, exec };
  }

  async function doDownload(installer: Installer, version: string) {
    let isDownloaded = false;
    const progressCallback = () => {
      isDownloaded = true;
    };

    // Version is already downloaded and present in local
    if (installer.state(version) !== missing) {
      isDownloaded = true;
    }
    const func = () =>
      installer.ensureDownloaded(version, {
        progressCallback,
      });
    const { events, result } = await listenWhile(installer, func);
    const binaryConfig = result as ElectronBinary;
    const { path: zipfile } = binaryConfig;

    expect(isDownloaded).toBe(true);
    expect(fs.existsSync(zipfile)).toBe(true);
    expect(installer.state(version)).toBe(downloaded);

    return { events, binaryConfig };
  }

  async function unZipBinary(): Promise<string> {
    const extractDir = path.join(paths.electronDownloads, version);
    fs.mkdirSync(extractDir, { recursive: true });

    await extract(fixture('electron-v13.1.7.zip'), {
      dir: extractDir,
    });

    return extractDir;
  }

  // tests

  describe('getExecPath()', () => {
    it.each([
      ['Linux', 'linux', 'electron'],
      ['Windows', 'win32', 'electron.exe'],
      ['macOS', 'darwin', 'Electron.app/Contents/MacOS/Electron'],
    ])('returns the right path on %s', (_, platform: string, expected: string) => {
      const subpath = Installer.execSubpath(platform);
      expect(subpath).toBe(expected);
    });
  });

  describe('ensureDownloaded()', () => {
    it('downloads the version if needed', async () => {
      // setup: version is not installed
      expect(installer.state(version)).toBe(missing);

      // test that the zipfile was downloaded
      const { events, binaryConfig } = await doDownload(installer, version);
      expect(events).toStrictEqual([
        { version, state: downloading },
        { version, state: downloaded },
      ]);
      expect(binaryConfig).toHaveProperty('alreadyExtracted', false);
    });

    it('does nothing if the version is already downloaded', async () => {
      // setup: version is already installed
      const { binaryConfig: config1 } = await doDownload(installer, version);
      const { path: zip1 } = config1;
      const { ctimeMs } = await fs.promises.stat(zip1);

      // test that ensureDownloaded() did nothing:
      const { events, binaryConfig: config2 } = await doDownload(installer, version);
      const { path: zip2 } = config2;

      expect(zip2).toEqual(zip1);
      expect((await fs.promises.stat(zip2)).ctimeMs).toEqual(ctimeMs);
      expect(events).toStrictEqual([]);
      expect(config1).toStrictEqual({
        path: config2.path,
        alreadyExtracted: false,
      });
    });

    it('makes use of the preinstalled electron versions', async () => {
      const extractDir = await unZipBinary();
      const {
        binaryConfig: { path: zipFile },
      } = await doDownload(installer, version);
      // Purposely remove the downloaded zip file
      fs.rmSync(zipFile, { force: true });

      const { binaryConfig } = await doDownload(installer, version);

      expect(binaryConfig).toStrictEqual({
        path: extractDir,
        alreadyExtracted: true,
      });
      expect(installer.state(version)).toBe(downloaded);
    });

    it('downloads the version if the zip file is missing', async () => {
      const {
        binaryConfig: { path: zipFile },
      } = await doDownload(installer, version);
      // Purposely remove the downloaded zip file
      fs.rmSync(zipFile, { force: true });
      expect(installer.state(version)).toBe(downloaded);

      // test that the zipfile was downloaded
      const { events, binaryConfig } = await doDownload(installer, version);
      expect(events).toStrictEqual([
        { version, state: downloading },
        { version, state: downloaded },
      ]);
      expect(binaryConfig).toHaveProperty('alreadyExtracted', false);
      expect(nockScope.isDone());
    });

    it('rejects versions that are not valid semver', async () => {
      await expect(installer.ensureDownloaded(path.join('..', 'x'))).rejects.toThrow(
        /Invalid Electron version/,
      );
    });

    it('resets install state on error', async () => {
      // setup: version is not installed
      expect(installer.state(version)).toBe(missing);

      nock.cleanAll();
      nockScope.get(/.*/).replyWithError('Server Error');

      await expect(doDownload(installer, version)).rejects.toThrow(Error);
      expect(installer.state(version)).toBe(missing);

      expect(nockScope.isDone());
    });
  });

  describe('remove()', () => {
    it('removes a download', async () => {
      // setup: version is already installed
      await doDownload(installer, version);

      const { events } = await doRemove(installer, version);
      expect(events).toStrictEqual([{ version, state: missing }]);
    });

    it('does nothing if the version is missing', async () => {
      // setup: version is not installed
      expect(installer.state(version)).toBe(missing);

      const { events } = await doRemove(installer, version);
      expect(events).toStrictEqual([]);
    });

    it('uninstalls the version if it is installed', async () => {
      // setup: version is installed
      await doInstall(installer, version);

      const { events } = await doRemove(installer, version);
      expect(events).toStrictEqual([{ version, state: missing }]);
      expect(installer.installedVersion).toBe(undefined);
    });

    it('removes the preinstalled electron versions', async () => {
      const extractDir = await unZipBinary();
      const {
        binaryConfig: { path: zipFile },
      } = await doDownload(installer, version);
      // Purposely remove the downloaded zip file
      fs.rmSync(zipFile, { force: true });
      expect(installer.state(version)).toBe(downloaded);

      const { events } = await doRemove(installer, version);

      expect(fs.existsSync(extractDir)).toBe(false);
      expect(events).toStrictEqual([{ version, state: missing }]);
    });

    it('rejects versions that are not valid semver', async () => {
      const canary = path.join(tmpdir, 'canary');
      await fs.promises.mkdir(canary);
      await expect(installer.remove(path.join('..', 'canary'))).rejects.toThrow(
        /Invalid Electron version/,
      );
      expect(fs.existsSync(canary)).toBe(true);
    });
  });

  describe('install()', () => {
    it('downloads a version if necessary', async () => {
      // setup: version is not downloaded
      expect(installer.state(version)).toBe(missing);
      expect(installer.installedVersion).toBe(undefined);

      const { events } = await doInstall(installer, version);
      expect(events).toStrictEqual([
        { version, state: downloading },
        { version, state: downloaded },
        { version, state: installing },
        { version, state: installed },
      ]);
    });

    it('unzips a version if necessary', async () => {
      // setup: version is downloaded but not installed
      await doDownload(installer, version);
      expect(installer.state(version)).toBe(downloaded);

      const { events } = await doInstall(installer, version);
      expect(events).toStrictEqual([
        { version, state: installing },
        { version, state: installed },
      ]);
    });

    it('does nothing if already installed', async () => {
      await doInstall(installer, version);

      const { events } = await doInstall(installer, version);
      expect(events).toStrictEqual([]);
    });

    it('replaces the previous installation', async () => {
      await doInstall(installer, version12);

      const { events } = await doInstall(installer, version13);

      expect(events).toStrictEqual([
        { version: version13, state: downloading },
        { version: version13, state: downloaded },
        { version: version13, state: installing },
        { version: version12, state: downloaded },
        { version: version13, state: installed },
      ]);
    });

    it('installs the already extracted electron version', async () => {
      await unZipBinary();
      const {
        binaryConfig: { path: zipFile },
      } = await doDownload(installer, version);

      // Purposely remove the downloaded zip file
      fs.rmSync(zipFile, { force: true });
      expect(installer.state(version)).toBe(downloaded);
      const { events } = await doInstall(installer, version);
      expect(events).toStrictEqual([
        { version: '13.1.7', state: 'installing' },
        { version: '13.1.7', state: 'installed' },
      ]);
    });

    it('throws error if already installing', async () => {
      const promise = doInstall(installer, version);
      try {
        await expect(doInstall(installer, version)).rejects.toThrow(
          'Currently installing',
        );
      } finally {
        await promise;
      }
    });

    it('leaves a valid state after an error', async () => {
      // setup: version is not installed
      expect(installer.state(version)).toBe(missing);

      const spy = vi
        .spyOn(installer, 'ensureDownloaded')
        .mockRejectedValueOnce(new Error('Download failed'));
      await expect(doInstall(installer, version)).rejects.toThrow(Error);
      expect(installer.state(version)).toBe(missing);
      spy.mockRestore();

      const { events } = await doInstall(installer, version);
      expect(events).toStrictEqual([
        { version, state: downloading },
        { version, state: downloaded },
        { version, state: installing },
        { version, state: installed },
      ]);
    });

    it('resets install state on error', async () => {
      // setup: version is downloaded but not installed
      await doDownload(installer, version);
      expect(installer.state(version)).toBe(downloaded);

      vi.mocked(extract).mockRejectedValue(new Error('Extract error'));

      await expect(doInstall(installer, version)).rejects.toThrow(Error);
      expect(installer.state(version)).toBe(downloaded);
    });
  });

  describe('installedVersion', () => {
    it('returns undefined if no version is installed', () => {
      expect(installer.installedVersion).toBe(undefined);
    });

    it('returns the installed version', async () => {
      expect(installer.installedVersion).toBe(undefined);
      await doInstall(installer, version);
      expect(installer.installedVersion).toBe(version);
    });
  });

  describe('state()', () => {
    it("returns 'installed' if the version is installed", async () => {
      await doInstall(installer, version);
      expect(installer.state(version)).toBe(installed);
    });

    it("returns 'downloaded' if the version is downloaded", async () => {
      await doDownload(installer, version);
      expect(installer.state(version)).toBe(downloaded);
    });

    it("returns 'missing' if the version is not downloaded", () => {
      expect(installer.state(version)).toBe(missing);
    });

    it("returns 'downloaded' if the version is kept extracted", async () => {
      expect(installer.state(version)).toBe(missing);
      await unZipBinary();
      const {
        binaryConfig: { path: zipFile },
      } = await doDownload(installer, version);
      // Purposely remove the downloaded zip file
      fs.rmSync(zipFile, { force: true });
      await doDownload(installer, version);

      expect(installer.state(version)).toBe(downloaded);
    });
  });
});
