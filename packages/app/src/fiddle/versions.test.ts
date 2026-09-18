import { describe, expect, it } from 'vitest';

import {
  compareVersions,
  getDefaultBisectRange,
  getOldestSupportedMajor,
  getReleaseChannel,
  getVersionRange,
  isObsolete,
  isSupportedOnPlatform,
  sortVersions,
  suggestLocalBuildName,
} from './versions';

describe('getReleaseChannel', () => {
  it('maps alpha and beta to beta, nightly to nightly, the rest to stable', () => {
    expect(getReleaseChannel('30.0.0')).toBe('stable');
    expect(getReleaseChannel('30.0.0-alpha.1')).toBe('beta');
    expect(getReleaseChannel('30.0.0-beta.3')).toBe('beta');
    expect(getReleaseChannel('30.0.0-nightly.20240101')).toBe('nightly');
    expect(getReleaseChannel('0.0.0-local.1')).toBe('stable');
  });
});

describe('sorting', () => {
  it('orders nightly < alpha < beta < stable within the same x.y.z', () => {
    const order = [
      '2.0.0-nightly.20200101',
      '2.0.0-alpha.2',
      '2.0.0-alpha.10',
      '2.0.0-beta.1',
      '2.0.0',
    ];
    for (let i = 0; i < order.length - 1; i++) {
      expect(compareVersions(order[i]!, order[i + 1]!)).toBe(-1);
      expect(compareVersions(order[i + 1]!, order[i]!)).toBe(1);
    }
    expect(compareVersions('2.0.0', '2.0.0')).toBe(0);
    expect(compareVersions('1.9.9', '2.0.0-nightly.1')).toBe(-1);
  });

  it('sorts newest first with non-semver last', () => {
    const input = [
      '1.0.0',
      '2.0.0-nightly.20200101',
      'local-b',
      '2.0.0',
      '2.0.0-beta.1',
      '2.0.0-alpha.2',
      '2.0.0-alpha.10',
      '10.0.0',
      'abc',
    ];
    expect(sortVersions(input)).toEqual([
      '10.0.0',
      '2.0.0',
      '2.0.0-beta.1',
      '2.0.0-alpha.10',
      '2.0.0-alpha.2',
      '2.0.0-nightly.20200101',
      '1.0.0',
      'local-b',
      'abc',
    ]);
    expect(input[0]).toBe('1.0.0');
  });

  it('sorts objects by their version', () => {
    expect(
      sortVersions([
        { version: '1.0.0' },
        { version: '3.0.0' },
        { version: '2.0.0' },
      ]).map((v) => v.version),
    ).toEqual(['3.0.0', '2.0.0', '1.0.0']);
  });
});

describe('obsolete versions', () => {
  it('is a release older than the oldest supported major', () => {
    expect(isObsolete('28.3.0', 29)).toBe(true);
    expect(isObsolete('29.0.0-alpha.1', 29)).toBe(false);
    expect(isObsolete('local', 29)).toBe(false);
  });

  it('finds the oldest supported major, with the NUM_STABLE_BRANCHES override', () => {
    const input = {
      stableMajors: [26, 27, 28, 29, 30],
      supportedMajors: [28, 29, 30, 31],
    };
    expect(getOldestSupportedMajor(input)).toBe(28);
    expect(getOldestSupportedMajor({ ...input, numStableBranches: '2' })).toBe(29);
    expect(getOldestSupportedMajor({ ...input, numStableBranches: 'x' })).toBe(28);
    expect(getOldestSupportedMajor({ ...input, numStableBranches: '0' })).toBe(28);
  });
});

describe('platform limits', () => {
  it('needs 11 or later on macOS arm64', () => {
    expect(isSupportedOnPlatform('10.4.7', 'darwin', 'arm64')).toBe(false);
    expect(isSupportedOnPlatform('11.0.0-beta.1', 'darwin', 'arm64')).toBe(false);
    expect(isSupportedOnPlatform('11.0.0', 'darwin', 'arm64')).toBe(true);
    expect(isSupportedOnPlatform('1.0.0', 'darwin', 'x64')).toBe(true);
  });

  it('needs 6.0.8 or later on Windows arm64', () => {
    expect(isSupportedOnPlatform('6.1.0', 'win32', 'arm64')).toBe(true);
    expect(isSupportedOnPlatform('6.0.7', 'win32', 'arm64')).toBe(false);
    expect(isSupportedOnPlatform('5.0.0', 'win32', 'arm64')).toBe(false);
    expect(isSupportedOnPlatform('6.0.8', 'win32', 'arm64')).toBe(true);
    expect(isSupportedOnPlatform('7.0.0', 'win32', 'arm64')).toBe(true);
    expect(isSupportedOnPlatform('30.0.0-beta.1', 'win32', 'arm64')).toBe(true);
    expect(isSupportedOnPlatform('1.0.0', 'win32', 'x64')).toBe(true);
  });

  it('allows everything elsewhere and non-semver versions', () => {
    expect(isSupportedOnPlatform('1.0.0', 'linux', 'arm64')).toBe(true);
    expect(isSupportedOnPlatform('local', 'darwin', 'arm64')).toBe(true);
  });
});

describe('suggestLocalBuildName', () => {
  it.each([
    ['/home/username/electron/gn/main/src/out/testing', 'gn/main - testing'],
    ['/home/username/electron/gn/main/src/out/testing/', 'gn/main - testing'],
    ['C:\\Users\\me\\electron\\gn\\main\\src\\out\\Release', 'gn/main - Release'],
    ['/src/out/Testing', 'Testing'],
    ['/out', 'out'],
  ])('%s → %s', (input, expected) => expect(suggestLocalBuildName(input)).toBe(expected));
});

describe('bisect ranges', () => {
  const visible = ['3.0.0', '2.1.0', '2.1.0-beta.1', '2.0.0', '1.0.0'];

  it('returns the inclusive range oldest first', () => {
    expect(getVersionRange('1.0.0', '2.1.0', visible)).toEqual([
      '1.0.0',
      '2.0.0',
      '2.1.0-beta.1',
      '2.1.0',
    ]);
    expect(getVersionRange('2.1.0', '1.0.0', visible)).toEqual([
      '1.0.0',
      '2.0.0',
      '2.1.0-beta.1',
      '2.1.0',
    ]);
    expect(getVersionRange('1.0.0', '9.0.0', visible)).toEqual([]);
  });

  it('defaults to the 11th visible version and the newest', () => {
    const many = Array.from({ length: 15 }, (_, i) => `${15 - i}.0.0`);
    expect(getDefaultBisectRange(many)).toEqual({ good: '5.0.0', bad: '15.0.0' });
    expect(getDefaultBisectRange(visible)).toEqual({ good: '1.0.0', bad: '3.0.0' });
    expect(getDefaultBisectRange(['1.0.0'])).toBeUndefined();
  });

  it('skips local builds', () => {
    expect(getVersionRange('local-a', '2.0.0', [...visible, 'local-a'])).toEqual([]);
    expect(getVersionRange('1.0.0', '3.0.0', [...visible, 'local-a'])).toEqual([
      '1.0.0',
      '2.0.0',
      '2.1.0-beta.1',
      '2.1.0',
      '3.0.0',
    ]);
    expect(getDefaultBisectRange(['3.0.0', '2.0.0', 'local-a', 'local-b'])).toEqual({
      good: '2.0.0',
      bad: '3.0.0',
    });
    expect(getDefaultBisectRange(['3.0.0', 'local-a'])).toBeUndefined();
  });
});
