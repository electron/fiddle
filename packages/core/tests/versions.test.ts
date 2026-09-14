import os from 'node:os';
import path from 'node:path';

import fs from 'node:fs';
import nock, { type Scope } from 'nock';
import * as semver from 'semver';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { BaseVersions, ElectronVersions } from '../src/versions.js';

describe('BaseVersions', () => {
  let testVersions: BaseVersions;

  beforeEach(async () => {
    const filename = path.join(import.meta.dirname, 'fixtures', 'releases.json');
    const json = JSON.parse(await fs.promises.readFile(filename, 'utf8')) as unknown;
    testVersions = new BaseVersions(json);
  });

  describe('.versions', () => {
    it('returns the expected versions', () => {
      const { versions } = testVersions;
      expect(versions.length).toBe(1027);
      expect(versions).toContainEqual(expect.objectContaining({ version: '13.0.1' }));
      expect(versions).not.toContainEqual(expect.objectContaining({ version: '13.0.2' }));
    });

    it('filters out unsupported 0.2x (atom-shell era) versions', () => {
      // Mirrors Electron Fiddle: drop everything in the 0.2x series, but keep
      // 0.30.0 and newer. Accepts both version-object and string input shapes.
      const objVersions = new BaseVersions([
        { version: '0.20.0' },
        { version: '0.24.0' },
        { version: '0.29.2' },
        { version: '0.30.0' },
        { version: '0.37.8' },
        { version: '13.0.1' },
      ]);
      expect(objVersions.versions.map((v) => v.version)).toEqual([
        '0.30.0',
        '0.37.8',
        '13.0.1',
      ]);

      const strVersions = new BaseVersions([
        '0.20.0',
        '0.24.0',
        '0.29.2',
        '0.30.0',
        '0.37.8',
        '13.0.1',
      ]);
      expect(strVersions.versions.map((v) => v.version)).toEqual([
        '0.30.0',
        '0.37.8',
        '13.0.1',
      ]);
    });

    it('does not return release info for filtered-out versions', () => {
      const filtered = new BaseVersions([
        {
          version: '0.24.0',
          date: '2015-04-17',
          node: '0.11.13',
          v8: '3.28.71.4',
          uv: '1.4.2',
          zlib: '1.2.8',
          openssl: '1.0.1',
          modules: '14',
          chrome: '41.0.2272.76',
          files: ['darwin-x64'],
        },
      ]);
      expect(filtered.versions.length).toBe(0);
      expect(filtered.getReleaseInfo('0.24.0')).toBe(undefined);
    });
  });

  describe('majors', () => {
    it('returns the expected prerelease majors', () => {
      const { prereleaseMajors } = testVersions;
      expect(prereleaseMajors).toEqual([14, 15, 16]);
    });

    it('returns stable majors in sorted order', () => {
      const { stableMajors } = testVersions;
      expect(stableMajors).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    });

    it('returns supported majors in sorted order', () => {
      const { supportedMajors } = testVersions;
      expect(supportedMajors).toEqual([11, 12, 13]);
    });

    it('returns obsolete majors in sorted order', () => {
      const { obsoleteMajors } = testVersions;
      expect(obsoleteMajors).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
  });

  describe('latest', () => {
    it('returns the latest release', () => {
      expect(testVersions.latest).not.toBe(undefined);
      expect(testVersions.latest!.version).toBe('16.0.0-nightly.20210726');
    });
  });

  describe('latestStable', () => {
    it('returns the latest stable release', () => {
      expect(testVersions.latestStable).not.toBe(undefined);
      expect(testVersions.latestStable!.version).toBe('13.1.7');
    });
  });

  describe('inRange()', () => {
    it('returns all the versions in a range', () => {
      let range = testVersions.inRange('12.0.0', '12.0.15');
      expect(range.length).toBe(16);
      expect(range.shift()!.version).toBe('12.0.0');
      expect(range.pop()!.version).toBe('12.0.15');

      range = testVersions.inRange(semver.parse('12.0.0')!, semver.parse('12.0.15')!);
      expect(range.length).toBe(16);
      expect(range.shift()!.version).toBe('12.0.0');
      expect(range.pop()!.version).toBe('12.0.15');
    });
  });

  describe('inMajor()', () => {
    it('returns all the versions in a branch', () => {
      const range = testVersions.inMajor(10);
      expect(range.length).toBe(101);
      expect(range.shift()!.version).toBe('10.0.0-nightly.20200209');
      expect(range.pop()!.version).toBe('10.4.7');
    });
  });

  describe('isVersion()', () => {
    it('returns true for existing versions', () => {
      expect(testVersions.isVersion('13.0.1')).toBe(true);
      expect(testVersions.isVersion('13.0.2')).toBe(false);
      expect(testVersions.isVersion(semver.parse('13.0.1')!)).toBe(true);
      expect(testVersions.isVersion(semver.parse('13.0.2')!)).toBe(false);
    });
  });

  describe('getLatestVersion()', () => {
    it('returns the latest version', () => {
      const latest = '16.0.0-nightly.20210726';
      expect(testVersions.latest).not.toBe(undefined);
      expect(testVersions.latest!.version).toBe(latest);
    });
  });

  describe('getVersionsInRange', () => {
    it('includes the expected versions', () => {
      const first = '10.0.0';
      const last = '11.0.0';
      const expected = [
        '10.0.0',
        '10.0.1',
        '10.1.0',
        '10.1.1',
        '10.1.2',
        '10.1.3',
        '10.1.4',
        '10.1.5',
        '10.1.6',
        '10.1.7',
        '10.2.0',
        '10.3.0',
        '10.3.1',
        '10.3.2',
        '10.4.0',
        '10.4.1',
        '10.4.2',
        '10.4.3',
        '10.4.4',
        '10.4.5',
        '10.4.6',
        '10.4.7',
        '11.0.0-nightly.20200525',
        '11.0.0-nightly.20200526',
        '11.0.0-nightly.20200529',
        '11.0.0-nightly.20200602',
        '11.0.0-nightly.20200603',
        '11.0.0-nightly.20200604',
        '11.0.0-nightly.20200609',
        '11.0.0-nightly.20200610',
        '11.0.0-nightly.20200611',
        '11.0.0-nightly.20200615',
        '11.0.0-nightly.20200616',
        '11.0.0-nightly.20200617',
        '11.0.0-nightly.20200618',
        '11.0.0-nightly.20200619',
        '11.0.0-nightly.20200701',
        '11.0.0-nightly.20200702',
        '11.0.0-nightly.20200703',
        '11.0.0-nightly.20200706',
        '11.0.0-nightly.20200707',
        '11.0.0-nightly.20200708',
        '11.0.0-nightly.20200709',
        '11.0.0-nightly.20200716',
        '11.0.0-nightly.20200717',
        '11.0.0-nightly.20200720',
        '11.0.0-nightly.20200721',
        '11.0.0-nightly.20200723',
        '11.0.0-nightly.20200724',
        '11.0.0-nightly.20200729',
        '11.0.0-nightly.20200730',
        '11.0.0-nightly.20200731',
        '11.0.0-nightly.20200803',
        '11.0.0-nightly.20200804',
        '11.0.0-nightly.20200805',
        '11.0.0-nightly.20200811',
        '11.0.0-nightly.20200812',
        '11.0.0-nightly.20200822',
        '11.0.0-nightly.20200824',
        '11.0.0-nightly.20200825',
        '11.0.0-nightly.20200826',
        '11.0.0-beta.1',
        '11.0.0-beta.3',
        '11.0.0-beta.4',
        '11.0.0-beta.5',
        '11.0.0-beta.6',
        '11.0.0-beta.7',
        '11.0.0-beta.8',
        '11.0.0-beta.9',
        '11.0.0-beta.11',
        '11.0.0-beta.12',
        '11.0.0-beta.13',
        '11.0.0-beta.16',
        '11.0.0-beta.17',
        '11.0.0-beta.18',
        '11.0.0-beta.19',
        '11.0.0-beta.20',
        '11.0.0-beta.22',
        '11.0.0-beta.23',
        '11.0.0',
      ] as const;

      let sems = testVersions.inRange(first, last);
      expect(sems.map((sem) => sem.version)).toEqual(expected);
      sems = testVersions.inRange(last, first);
      expect(sems.map((sem) => sem.version)).toEqual(expected);
    });
  });

  describe('getReleaseInfo()', () => {
    it('returns release info for a known version', () => {
      const version = '16.0.0-nightly.20210726';
      const releaseInfo = testVersions.getReleaseInfo(version);
      expect(releaseInfo).not.toBe(undefined);
      expect(releaseInfo).toMatchObject({
        version,
        chrome: '93.0.4566.0',
        date: '2021-07-26',
        files: [
          'darwin-x64',
          'darwin-x64-symbols',
          'linux-ia32',
          'linux-ia32-symbols',
          'linux-x64',
          'linux-x64-symbols',
          'win32-ia32',
          'win32-ia32-symbols',
          'win32-x64',
          'win32-x64-symbols',
        ],
        modules: '89',
        node: '16.5.0',
        openssl: '1.1.1',
        uv: '1.41.0',
        v8: '9.3.278-electron.0',
        zlib: '1.2.11',
      });
    });

    it('does not return release info for an unknown version', () => {
      const releaseInfo = testVersions.getReleaseInfo('0.0.0');
      expect(releaseInfo).toBe(undefined);
    });

    it('does not return release info if partial info', () => {
      const version = '16.0.0-nightly.20210726';
      const partialVersions = new BaseVersions([
        { version, node: '16.5.0', openssl: '1.1.1' },
      ]);
      const releaseInfo = partialVersions.getReleaseInfo(version);
      expect(releaseInfo).toBe(undefined);
    });
  });
});

describe('ElectronVersions', () => {
  let nockScope: Scope;
  let tmpdir: string;
  let versionsCache: string;
  const releasesFixturePath = path.join(import.meta.dirname, 'fixtures', 'releases.json');

  beforeAll(async () => {
    tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fiddle-core-'));
  });

  beforeEach(async () => {
    // Copy the releases.json fixture over to populate the versions cache
    versionsCache = path.join(tmpdir, 'versions.json');
    await fs.promises.copyFile(releasesFixturePath, versionsCache);

    nock.disableNetConnect();
    nockScope = nock('https://releases.electronjs.org');
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  afterAll(() => {
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  describe('.create', () => {
    it('does not fetch with a fresh cache', async () => {
      await fs.promises.writeFile(
        versionsCache,
        JSON.stringify([
          {
            version: '0.30.0',
          },
        ]),
        'utf8',
      );
      expect(nockScope.isDone()); // No mocks
      const { versions } = await ElectronVersions.create({
        paths: { versionsCache },
      });
      expect(versions.length).toBe(1);
    });

    it('fetches with a missing cache', async () => {
      const scope = nockScope.get('/releases.json').reply(
        200,
        JSON.stringify([
          {
            version: '0.30.0',
          },
          {
            version: '0.30.1',
          },
        ]),
        {
          'Content-Type': 'application/json',
        },
      );
      await fs.promises.rm(versionsCache, { force: true });
      const { versions } = await ElectronVersions.create({
        paths: { versionsCache },
      });
      expect(scope.isDone());
      expect(versions.length).toBe(2);
    });

    it('throws an error with a missing cache and failed fetch', async () => {
      const scope = nockScope.get('/releases.json').replyWithError('Error');
      await fs.promises.rm(versionsCache, { force: true });
      await expect(ElectronVersions.create({ paths: { versionsCache } })).rejects.toThrow(
        Error,
      );
      expect(scope.isDone());
    });

    it('throws an error with a missing cache and a non-200 server response', async () => {
      const scope = nockScope
        .get('/releases.json')
        .reply(500, JSON.stringify({ error: true }), {
          'Content-Type': 'application/json',
        });
      await fs.promises.rm(versionsCache, { force: true });
      await expect(ElectronVersions.create({ paths: { versionsCache } })).rejects.toThrow(
        Error,
      );
      expect(scope.isDone());
    });

    // @feature versions.refresh
    it('fetches with a stale cache', async () => {
      const scope = nockScope.get('/releases.json').reply(
        200,
        JSON.stringify([
          {
            version: '0.30.0',
          },
          {
            version: '0.30.1',
          },
          {
            version: '0.30.2',
          },
        ]),
        {
          'Content-Type': 'application/json',
        },
      );
      const staleCacheMtime = Date.now() / 1000 - 5 * 60 * 60;
      await fs.promises.utimes(versionsCache, staleCacheMtime, staleCacheMtime);
      const { versions } = await ElectronVersions.create({
        paths: { versionsCache },
      });
      expect(scope.isDone());
      expect(versions.length).toBe(3);
    });

    // @feature versions.bundled-list
    it('uses stale cache when fetch fails', async () => {
      const scope = nockScope.get('/releases.json').replyWithError('Error');
      const staleCacheMtime = Date.now() / 1000 - 5 * 60 * 60;
      await fs.promises.utimes(versionsCache, staleCacheMtime, staleCacheMtime);
      const { versions } = await ElectronVersions.create({
        paths: { versionsCache },
      });
      expect(scope.isDone());
      expect(versions.length).toBe(1027);
    });

    // @feature versions.bundled-list
    it('uses options.initialVersions if missing cache', async () => {
      await fs.promises.rm(versionsCache, { force: true });
      expect(nockScope.isDone()); // No mocks
      const initialVersions = [
        {
          version: '0.30.0',
        },
        {
          version: '0.30.1',
        },
      ];
      const { versions } = await ElectronVersions.create({
        initialVersions,
        paths: { versionsCache },
      });
      expect(versions.length).toBe(2);
    });

    it('does not use options.initialVersions if cache available', async () => {
      await fs.promises.writeFile(
        versionsCache,
        JSON.stringify([
          {
            version: '0.30.0',
          },
        ]),
        'utf8',
      );
      expect(nockScope.isDone()); // No mocks
      const initialVersions = [
        {
          version: '0.30.0',
        },
        {
          version: '0.30.1',
        },
      ];
      const { versions } = await ElectronVersions.create({
        initialVersions,
        paths: { versionsCache },
      });
      expect(versions.length).toBe(1);
    });

    it('does not use cache if options.ignoreCache is true', async () => {
      await fs.promises.writeFile(
        versionsCache,
        JSON.stringify([
          {
            version: '0.30.0',
          },
        ]),
        'utf8',
      );
      const scope = nockScope.get('/releases.json').reply(
        200,
        JSON.stringify([
          {
            version: '0.30.0',
          },
          {
            version: '0.30.1',
          },
          {
            version: '0.30.2',
          },
        ]),
        {
          'Content-Type': 'application/json',
        },
      );
      const { versions } = await ElectronVersions.create({
        ignoreCache: true,
        paths: { versionsCache },
      });
      expect(scope.isDone());
      expect(versions.length).toBe(3);
    });

    it('uses options.initialVersions if cache available but options.ignoreCache is true', async () => {
      await fs.promises.writeFile(
        versionsCache,
        JSON.stringify([
          {
            version: '0.30.0',
          },
        ]),
        'utf8',
      );
      expect(nockScope.isDone()); // No mocks
      const initialVersions = [
        {
          version: '0.30.0',
        },
        {
          version: '0.30.1',
        },
      ];
      const { versions } = await ElectronVersions.create({
        initialVersions,
        ignoreCache: true,
        paths: { versionsCache },
      });
      expect(versions.length).toBe(2);
    });
  });

  describe('.fetch', () => {
    it('updates the cache', async () => {
      const electronVersions = await ElectronVersions.create({
        paths: { versionsCache },
      });
      expect(electronVersions.versions.length).toBe(1027);

      const scope = nockScope.get('/releases.json').reply(
        200,
        JSON.stringify([
          {
            version: '0.30.0',
          },
          {
            version: '0.30.1',
          },
          {
            version: '0.30.2',
          },
          {
            version: '0.30.3',
          },
        ]),
        {
          'Content-Type': 'application/json',
        },
      );
      await electronVersions.fetch();
      expect(scope.isDone());
      expect(electronVersions.versions.length).toBe(4);
    });
  });
});
