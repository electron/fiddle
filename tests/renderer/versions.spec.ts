import * as semver from 'semver';
import { describe, expect, it, vi } from 'vitest';

import {
  ElectronReleaseChannel,
  GlobalSetting,
  RunnableVersion,
  Version,
} from '../../src/interfaces';
import {
  addLocalVersion,
  fetchVersions,
  getDefaultVersion,
  getLocalVersions,
  getReleaseChannel,
} from '../../src/renderer/versions';

const mockVersions: Array<Partial<RunnableVersion>> = [
  { version: 'test-0', localPath: '/test/path/0' },
  { version: 'test-1', localPath: '/test/path/1' },
  { version: 'test-2', localPath: '/test/path/2' },
];

describe('versions', () => {
  describe('getDefaultVersion()', () => {
    it('handles a stored version', () => {
      vi.mocked(localStorage.getItem).mockReturnValue('2.0.2');
      const output = getDefaultVersion([
        { version: '2.0.2' } as RunnableVersion,
      ]);
      expect(output).toBe('2.0.2');
    });

    it('uses the newest stable as a fallback', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);
      vi.mocked(window.ElectronFiddle.getLatestStable).mockReturnValue(
        semver.parse('13.0.0')!,
      );
      const output = getDefaultVersion([
        { version: '11.0.0' },
        { version: '15.0.0-nightly.20210715' },
        { version: '13.0.0' },
        { version: '15.0.0-alpha.1' },
        { version: '12.0.0' },
        { version: '14.0.0-beta.1' },
      ] as RunnableVersion[]);
      expect(output).toBe('13.0.0');
    });

    it('throws if everything goes wrong', () => {
      expect(() => getDefaultVersion([])).toThrow();
    });
  });

  describe('getReleaseChannel()', () => {
    it('identifies a nightly release', () => {
      expect(
        getReleaseChannel({
          version: 'v4.0.0-nightly.20180817',
        } as Version),
      ).toBe(ElectronReleaseChannel.nightly);
    });

    it('identifies a beta release', () => {
      expect(
        getReleaseChannel({
          version: 'v3.0.0-beta.4',
        } as Version),
      ).toBe(ElectronReleaseChannel.beta);
    });

    it('identifies a stable release', () => {
      expect(
        getReleaseChannel({
          version: 'v3.0.0',
        } as Version),
      ).toBe(ElectronReleaseChannel.stable);
    });

    it('identifies an unknown release as stable', () => {
      expect(getReleaseChannel({} as Version)).toBe(
        ElectronReleaseChannel.stable,
      );
    });
  });

  describe('addLocalVersion()', () => {
    it('adds a local version', () => {
      vi.mocked(window.ElectronFiddle.addLocalVersion).mockReturnValue([
        mockVersions[0],
        mockVersions[1],
      ] as Version[]);

      expect(addLocalVersion('token-123', 'my-build')).toEqual([
        mockVersions[0],
        mockVersions[1],
      ]);
      expect(window.ElectronFiddle.addLocalVersion).toHaveBeenCalledWith(
        'token-123',
        'my-build',
      );
    });
  });

  describe('getLocalVersions', () => {
    it('returns versions from the main process', () => {
      vi.mocked(window.ElectronFiddle.getLocalVersions).mockReturnValue([
        mockVersions[0] as Version,
      ]);
      expect(getLocalVersions()).toEqual([mockVersions[0]]);
    });

    it('returns an empty array if none exist', () => {
      vi.mocked(window.ElectronFiddle.getLocalVersions).mockReturnValue([]);
      expect(getLocalVersions()).toEqual([]);
    });
  });

  describe('fetchVersions()', () => {
    it('removes knownVersions from localStorage', async () => {
      vi.mocked(window.ElectronFiddle.fetchVersions).mockResolvedValue([]);
      await fetchVersions();
      expect(localStorage.removeItem).toHaveBeenCalledWith(
        GlobalSetting.knownVersion,
      );
    });
  });
});
