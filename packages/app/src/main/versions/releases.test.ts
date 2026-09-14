import { describe, expect, it } from 'vitest';

import { isReleaseList, toReleaseRows, visibleVersions } from './releases';

const data = [
  { version: '40.1.0', date: '2026-01-01', node: '22.1.0' },
  { version: '44.0.0-beta.3', date: '2026-08-01', node: '24.0.0' },
  { version: '43.0.0', date: '2026-07-01', node: '24.0.0' },
  { version: '10.0.0', date: '2020-01-01', node: '12.0.0' },
];

describe('toReleaseRows', () => {
  const options = { stableMajors: [10, 40, 43], supportedMajors: [40, 43], platform: 'linux', arch: 'x64' };

  // @feature versions.obsolete
  it('sorts newest first and flags obsolete majors', () => {
    const rows = toReleaseRows(data, options);
    expect(rows.map((r) => r.version)).toEqual(['44.0.0-beta.3', '43.0.0', '40.1.0', '10.0.0']);
    expect(rows.find((r) => r.version === '10.0.0')?.obsolete).toBe(true);
    expect(rows.find((r) => r.version === '40.1.0')?.obsolete).toBe(false);
  });

  // @feature versions.obsolete
  it('honours NUM_STABLE_BRANCHES', () => {
    const rows = toReleaseRows(data, { ...options, numStableBranches: '1' });
    expect(rows.find((r) => r.version === '40.1.0')?.obsolete).toBe(true);
  });

  // @feature versions.platform-limits
  it('marks versions the platform cannot run', () => {
    const rows = toReleaseRows([{ version: '10.0.0' }], { ...options, platform: 'darwin', arch: 'arm64' });
    expect(rows[0]).toMatchObject({ supported: false, date: '', node: '' });
  });
});

describe('visibleVersions', () => {
  const rows = [
    { version: '46.0.0-nightly.20260911', date: '', node: '', obsolete: false, supported: true },
    { version: '44.0.0-beta.3', date: '', node: '', obsolete: false, supported: true },
    { version: '43.0.0', date: '', node: '', obsolete: false, supported: true },
    { version: '42.0.0', date: '', node: '', obsolete: false, supported: false },
    { version: '10.0.0', date: '', node: '', obsolete: true, supported: true },
  ];
  const base = { channels: ['stable', 'beta'] as ('stable' | 'beta' | 'nightly')[], showObsolete: false, showNotDownloaded: true };
  const none = () => false;

  // @feature versions.channels settings.channels settings.show-obsolete
  it('filters by channel, obsolete and platform support', () => {
    expect(visibleVersions(rows, base, none)).toEqual(['44.0.0-beta.3', '43.0.0']);
    expect(visibleVersions(rows, { ...base, channels: ['nightly'] }, none)).toEqual(['46.0.0-nightly.20260911']);
    expect(visibleVersions(rows, { ...base, showObsolete: true }, none)).toContain('10.0.0');
  });

  // @feature settings.show-not-downloaded
  it('can hide versions that are not downloaded, but keeps the current one', () => {
    const hidden = { ...base, showNotDownloaded: false };
    expect(visibleVersions(rows, hidden, (v) => v === '43.0.0')).toEqual(['43.0.0']);
    expect(visibleVersions(rows, hidden, none, ['44.0.0-beta.3'])).toEqual(['44.0.0-beta.3']);
  });
});

describe('isReleaseList', () => {
  it('accepts releases.json and rejects anything else', () => {
    expect(isReleaseList(data)).toBe(true);
    expect(isReleaseList([])).toBe(false);
    expect(isReleaseList({ version: '1.0.0' })).toBe(false);
    expect(isReleaseList([{ name: 'x' }])).toBe(false);
  });
});
