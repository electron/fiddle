import { describe, expect, it } from 'vitest';

import type { VersionRef } from '../../fiddle/fiddle';
import type { LocalBuild } from '../../shared/stores';
import {
  defaultVersionFor,
  firstUsableVersion,
  hiddenChannel,
  versionProblem,
  type VersionCatalog,
} from './selection';
import { row } from './test-helpers';

const rows = [
  row('44.0.0-beta.3'),
  row('43.0.0'),
  row('42.4.1'),
  row('10.0.0', { supported: false }),
];
const builds: LocalBuild[] = [
  { id: 'gone', name: 'gone', path: '/gone', available: false },
  { id: 'ok', name: 'ok', path: '/ok', available: true },
];
const lookup = (localBuilds: readonly LocalBuild[] = builds) => ({
  release: (version: string) => rows.find((r) => r.version === version),
  localBuild: (id: string) => localBuilds.find((b) => b.id === id),
});
const release = (version: string): VersionRef => ({ kind: 'release', version });
const local = (id: string): VersionRef => ({ kind: 'local', id });

function catalog(extra: Partial<VersionCatalog> = {}): VersionCatalog {
  return {
    rows,
    localBuilds: [],
    settings: {
      channels: ['stable', 'beta'],
      showObsolete: false,
      showNotDownloaded: true,
    },
    isInstalled: () => false,
    ...extra,
  };
}

describe('versionProblem', () => {
  it('accepts runnable releases and available local builds', () => {
    expect(versionProblem(release('43.0.0'), lookup())).toBeUndefined();
    expect(versionProblem(local('ok'), lookup())).toBeUndefined();
  });

  it('names what is wrong', () => {
    expect(versionProblem(release('99.0.0'), lookup())).toBe('unknown');
    expect(versionProblem(release('10.0.0'), lookup())).toBe('unsupported');
    expect(versionProblem(local('gone'), lookup())).toBe('localMissing');
    expect(versionProblem(local('nope'), lookup())).toBe('localUnknown');
  });
});

describe('firstUsableVersion', () => {
  it('takes the newest visible release', () => {
    expect(firstUsableVersion(catalog())).toEqual(release('44.0.0-beta.3'));
    expect(
      firstUsableVersion(
        catalog({
          settings: {
            channels: ['stable'],
            showObsolete: false,
            showNotDownloaded: true,
          },
        }),
      ),
    ).toEqual(release('43.0.0'));
  });

  it('takes an available local build first', () => {
    expect(firstUsableVersion(catalog({ localBuilds: builds }))).toEqual(local('ok'));
  });

  it('skips the version it replaces', () => {
    expect(firstUsableVersion(catalog(), { exclude: release('44.0.0-beta.3') })).toEqual(
      release('43.0.0'),
    );
  });

  it('can insist on a downloaded release', () => {
    const isInstalled = (version: string) => version === '42.4.1';
    expect(firstUsableVersion(catalog({ isInstalled }), { installedOnly: true })).toEqual(
      release('42.4.1'),
    );
    expect(firstUsableVersion(catalog(), { installedOnly: true })).toBeUndefined();
  });

  it('uses a hidden release when nothing is visible', () => {
    const settings = {
      channels: ['nightly' as const],
      showObsolete: false,
      showNotDownloaded: true,
    };
    expect(firstUsableVersion(catalog({ settings }))).toEqual(release('44.0.0-beta.3'));
    expect(firstUsableVersion(catalog({ rows: [] }))).toBeUndefined();
  });
});

describe('defaultVersionFor', () => {
  it('uses the last version the user picked', () => {
    expect(defaultVersionFor(rows, release('42.4.1'), lookup())).toEqual(
      release('42.4.1'),
    );
    expect(defaultVersionFor(rows, local('ok'), lookup())).toEqual(local('ok'));
  });

  it('defaults to the latest stable release, not a newer beta', () => {
    expect(defaultVersionFor(rows, undefined, lookup())).toEqual(release('43.0.0'));
  });

  it('ignores a last version that is no longer usable', () => {
    expect(defaultVersionFor(rows, release('99.0.0'), lookup())).toEqual(
      release('43.0.0'),
    );
    expect(defaultVersionFor(rows, local('gone'), lookup())).toEqual(release('43.0.0'));
    expect(defaultVersionFor(rows, local('ok'), lookup([]))).toEqual(release('43.0.0'));
  });

  it('is undefined without releases', () => {
    expect(defaultVersionFor([], undefined, lookup())).toBeUndefined();
  });
});

describe('hiddenChannel', () => {
  it('names the channel only when the settings hide it', () => {
    expect(hiddenChannel('44.0.0-beta.3', ['stable'])).toBe('beta');
    expect(hiddenChannel('44.0.0-alpha.1', ['stable', 'beta'])).toBeUndefined();
    expect(hiddenChannel('45.0.0-nightly.20260901', ['stable', 'beta'])).toBe('nightly');
    expect(hiddenChannel('43.0.0', ['stable'])).toBeUndefined();
  });
});
