import { ElectronVersions } from '@electron/fiddle-core';
import fs from 'fs-extra';
import * as semver from 'semver';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { InstallState, Version } from '../../src/interfaces';
import {
  addLocalVersion,
  getLatestStable,
  getLocalVersionState,
  getLocalVersions,
  getOldestSupportedMajor,
  getReleasedVersions,
  isReleasedMajor,
  migrateLocalVersions,
  removeLocalVersion,
  setPendingLocalPath,
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
      const spy = vi
        .spyOn(knownVersions, 'versions', 'get')
        .mockReturnValue(expected.map(({ version }) => semver.parse(version)!));

      const result = getReleasedVersions();

      expect(result).toEqual(expected);
      spy.mockRestore();
    });

    it('does not fetch versions < 0.24.0', () => {
      const spy = vi
        .spyOn(knownVersions, 'versions', 'get')
        .mockReturnValue([semver.parse('0.23.0')!]);

      const result = getReleasedVersions();

      expect(result).toHaveLength(0);
      spy.mockRestore();
    });
  });

  describe('getLocalVersionState()', () => {
    it('returns installed if the exec path exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const ver: Version = { version: '1.0.0', localPath: '/path/to/electron' };
      expect(getLocalVersionState(ver)).toBe(InstallState.installed);
    });

    it('returns missing if the exec path does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const ver: Version = { version: '1.0.0', localPath: '/path/to/electron' };
      expect(getLocalVersionState(ver)).toBe(InstallState.missing);
    });

    it('returns missing if localPath is undefined', () => {
      const ver: Version = { version: '1.0.0' };
      expect(getLocalVersionState(ver)).toBe(InstallState.missing);
    });
  });

  describe('local version management', () => {
    const emptyState = JSON.stringify({ migrated: false, versions: [] });

    beforeEach(async () => {
      // Provide clean persisted state so loadLocalVersions resets properly
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(emptyState);
      await setupVersions();
      vi.mocked(fs.existsSync).mockReset();
      vi.mocked(fs.readFileSync).mockReset();
      vi.mocked(fs.writeFileSync).mockClear();
    });

    describe('addLocalVersion()', () => {
      it('adds a local version and persists', () => {
        setPendingLocalPath('token-1', '/my/build');
        const result = addLocalVersion('token-1', 'my build');

        expect(result).toContainEqual(
          expect.objectContaining({ localPath: '/my/build', name: 'my build' }),
        );
        expect(getLocalVersions()).toContainEqual(
          expect.objectContaining({ localPath: '/my/build', name: 'my build' }),
        );
        expect(fs.writeFileSync).toHaveBeenCalled();
      });

      it('does not add duplicates by localPath', () => {
        setPendingLocalPath('token-1', '/my/build');
        addLocalVersion('token-1', 'my build');
        vi.mocked(fs.writeFileSync).mockClear();

        setPendingLocalPath('token-2', '/my/build');
        const result = addLocalVersion('token-2', 'my build 2');
        expect(result.filter((v) => v.localPath === '/my/build')).toHaveLength(
          1,
        );
        expect(fs.writeFileSync).not.toHaveBeenCalled();
      });

      it('rejects an invalid token', () => {
        const result = addLocalVersion('bogus-token', 'name');
        expect(result).toHaveLength(0);
        expect(fs.writeFileSync).not.toHaveBeenCalled();
      });

      it('consumes the token so it cannot be reused', () => {
        setPendingLocalPath('token-once', '/my/build');
        addLocalVersion('token-once', 'first');
        vi.mocked(fs.writeFileSync).mockClear();

        const result = addLocalVersion('token-once', 'second');
        // Should not add a second entry — token is consumed
        expect(result.filter((v) => v.localPath === '/my/build')).toHaveLength(
          1,
        );
        expect(fs.writeFileSync).not.toHaveBeenCalled();
      });
    });

    describe('removeLocalVersion()', () => {
      it('removes a version by its version key', () => {
        setPendingLocalPath('token-rm', '/my/build');
        const added = addLocalVersion('token-rm', 'my build');
        const versionKey = added.find(
          (v) => v.localPath === '/my/build',
        )!.version;
        vi.mocked(fs.writeFileSync).mockClear();

        const result = removeLocalVersion(versionKey);
        expect(result).not.toContainEqual(
          expect.objectContaining({ localPath: '/my/build' }),
        );
        expect(getLocalVersions()).not.toContainEqual(
          expect.objectContaining({ localPath: '/my/build' }),
        );
        expect(fs.writeFileSync).toHaveBeenCalled();
      });
    });

    describe('migrateLocalVersions()', () => {
      it('accepts migration on first call', () => {
        const versions: Version[] = [
          { version: '1.0.0', localPath: '/path/a' },
          { version: '2.0.0', localPath: '/path/b' },
        ];

        const accepted = migrateLocalVersions(versions);
        expect(accepted).toBe(true);
        expect(getLocalVersions()).toEqual(versions);
        expect(fs.writeFileSync).toHaveBeenCalled();
      });

      it('rejects migration on subsequent calls', () => {
        migrateLocalVersions([{ version: '1.0.0', localPath: '/path/a' }]);
        vi.mocked(fs.writeFileSync).mockClear();

        const accepted = migrateLocalVersions([
          { version: '3.0.0', localPath: '/path/c' },
        ]);
        expect(accepted).toBe(false);
        expect(fs.writeFileSync).not.toHaveBeenCalled();
      });

      it('filters out invalid entries', () => {
        const versions = [
          { version: '1.0.0', localPath: '/valid' },
          { version: '2.0.0', localPath: '' },
          { version: null, localPath: '/no-version' },
          null,
        ] as unknown as Version[];

        migrateLocalVersions(versions);
        expect(getLocalVersions()).toEqual([
          { version: '1.0.0', localPath: '/valid' },
        ]);
      });

      it('does not add duplicates by localPath', () => {
        setPendingLocalPath('token-dup', '/path/a');
        addLocalVersion('token-dup', 'build a');

        migrateLocalVersions([
          { version: '1.0.0-dup', localPath: '/path/a' },
          { version: '2.0.0', localPath: '/path/b' },
        ]);

        const locals = getLocalVersions();
        expect(locals.filter((v) => v.localPath === '/path/a')).toHaveLength(1);
        expect(locals).toContainEqual({
          version: '2.0.0',
          localPath: '/path/b',
        });
      });
    });

    describe('loadLocalVersions()', () => {
      it('loads persisted versions on setup', async () => {
        const stored = {
          migrated: true,
          versions: [{ version: '5.0.0', localPath: '/stored' }],
        };
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(stored));

        await setupVersions();

        expect(getLocalVersions()).toEqual(stored.versions);
        // Since migrated was true, further migration should be rejected
        expect(
          migrateLocalVersions([{ version: '6.0.0', localPath: '/new' }]),
        ).toBe(false);
      });
    });
  });
});
