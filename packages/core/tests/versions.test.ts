import path from 'node:path';

import fs from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';

import { ElectronVersions } from '../src/versions.js';

describe('ElectronVersions', () => {
  let testVersions: ElectronVersions;

  beforeEach(async () => {
    const filename = path.join(import.meta.dirname, 'fixtures', 'releases.json');
    const json = JSON.parse(await fs.promises.readFile(filename, 'utf8')) as unknown;
    testVersions = new ElectronVersions(json);
  });

  it('filters out unsupported 0.2x (atom-shell era) versions', () => {
    // Drops the 0.2x series but keeps 0.30.0 and newer, for both the
    // version-object and the string input shapes.
    const inputs = ['0.20.0', '0.24.0', '0.29.2', '0.30.0', '0.37.8', '13.0.1'];
    const objVersions = new ElectronVersions(inputs.map((version) => ({ version })));
    const strVersions = new ElectronVersions(inputs);
    for (const versions of [objVersions, strVersions]) {
      expect(inputs.filter((v) => versions.isVersion(v))).toEqual([
        '0.30.0',
        '0.37.8',
        '13.0.1',
      ]);
    }
  });

  it('does not return release info for filtered-out versions', () => {
    const filtered = new ElectronVersions([
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
    expect(filtered.isVersion('0.24.0')).toBe(false);
    expect(filtered.getReleaseInfo('0.24.0')).toBe(undefined);
  });

  describe('majors', () => {
    it('returns stable majors in sorted order', () => {
      const { stableMajors } = testVersions;
      expect(stableMajors).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    });

    it('returns supported majors in sorted order', () => {
      const { supportedMajors } = testVersions;
      expect(supportedMajors).toEqual([11, 12, 13]);
    });
  });

  describe('isVersion()', () => {
    it('returns true for existing versions', () => {
      expect(testVersions.isVersion('13.0.1')).toBe(true);
      expect(testVersions.isVersion('13.0.2')).toBe(false);
      expect(testVersions.isVersion('16.0.0-nightly.20210726')).toBe(true);
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
      const partialVersions = new ElectronVersions([
        { version, node: '16.5.0', openssl: '1.1.1' },
      ]);
      const releaseInfo = partialVersions.getReleaseInfo(version);
      expect(releaseInfo).toBe(undefined);
    });
  });
});
