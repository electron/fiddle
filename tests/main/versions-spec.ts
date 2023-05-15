import { ElectronVersions } from '@electron/fiddle-core';
import * as semver from 'semver';

import {
  getLatestStable,
  getOldestSupportedMajor,
  getReleasedVersions,
  isReleasedMajor,
  setupVersions,
} from '../../src/main/versions';

describe('versions', () => {
  let knownVersions: ElectronVersions;

  beforeAll(async () => {
    knownVersions = await setupVersions();
  });

  describe('getOldestSupportedMajor()', () => {
    function getExpectedOldestSupportedVersion() {
      const NUM_BRANCHES = parseInt(process.env.NUM_STABLE_BRANCHES || '') || 3;
      return getLatestStable()!.major + 1 - NUM_BRANCHES;
    }

    it('matches expected oldest supported version', () => {
      const expected = getExpectedOldestSupportedVersion();
      expect(getOldestSupportedMajor()).toBe(expected);
    });

    it('honors process.env.NUM_STABLE_BRANCHES', () => {
      process.env.NUM_STABLE_BRANCHES = '2';
      const expected = getExpectedOldestSupportedVersion();
      expect(getOldestSupportedMajor()).toBe(expected);
    });
  });

  describe('isReleasedMajor()', () => {
    it('returns true for recognized releases', () => {
      expect(isReleasedMajor(3)).toBe(true);
    });

    it('returns false for unrecognized releases', () => {
      expect(isReleasedMajor(1000)).toBe(false);
    });
  });

  describe('getReleasedVersions()', () => {
    it('includes versions >= 0.24.0', () => {
      const expected = [
        { version: '10.0.0-nightly.20200303' },
        { version: '9.0.0-beta.5' },
        { version: '4.2.0' },
      ];
      const spy = jest
        .spyOn(knownVersions, 'versions', 'get')
        .mockReturnValue(expected.map(({ version }) => semver.parse(version)!));

      const result = getReleasedVersions();

      expect(result).toEqual(expected);
      spy.mockRestore();
    });

    it('does not fetch versions < 0.24.0', () => {
      const spy = jest
        .spyOn(knownVersions, 'versions', 'get')
        .mockReturnValue([semver.parse('0.23.0')!]);

      const result = getReleasedVersions();

      expect(result).toHaveLength(0);
      spy.mockRestore();
    });
  });
});
