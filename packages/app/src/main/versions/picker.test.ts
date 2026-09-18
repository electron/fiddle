import { describe, expect, it } from 'vitest';

import type { LocalBuild, ReleaseRow, VersionsState } from '../../shared/stores';
import { normalizeVersionQuery, pickerGroups, type PickerInput } from './releases';

const row = (version: string, extra: Partial<ReleaseRow> = {}): ReleaseRow => ({
  version,
  date: '',
  node: '',
  obsolete: false,
  supported: true,
  ...extra,
});

const allChannels = {
  channels: ['stable', 'beta', 'nightly'] as const,
  showObsolete: true,
  showNotDownloaded: true,
};

function groups(input: Partial<PickerInput>) {
  return pickerGroups({
    rows: [],
    settings: { ...allChannels, channels: [...allChannels.channels] },
    installs: {},
    localBuilds: [],
    ...input,
  });
}

const ids = (input: Partial<PickerInput>) =>
  groups(input).map((g) => [g.key, g.entries.map((e) => e.label)]);

describe('pickerGroups', () => {
  // Newest first, as `toReleaseRows` sorts them.
  const rows = [
    row('44.0.0-beta.3'),
    row('43.0.0'),
    row('43.0.0-beta.1'),
    row('43.0.0-alpha.2'),
    row('43.0.0-nightly.20260101'),
    row('42.4.1'),
  ];

  it('keeps the design groups, each newest first', () => {
    expect(ids({ rows })).toEqual([
      ['stable', ['43.0.0', '42.4.1']],
      [
        'prerelease',
        ['44.0.0-beta.3', '43.0.0-beta.1', '43.0.0-alpha.2', '43.0.0-nightly.20260101'],
      ],
    ]);
  });

  it('drops the groups while searching: one newest-first list, nightly < alpha < beta < stable', () => {
    expect(ids({ rows, query: '43.0.0' })).toEqual([
      [
        'results',
        ['43.0.0', '43.0.0-beta.1', '43.0.0-alpha.2', '43.0.0-nightly.20260101'],
      ],
    ]);
  });

  it('puts local builds first, and matches their names', () => {
    const localBuilds: LocalBuild[] = [
      { id: 'a', name: 'gn/main - testing', path: '/a', available: true },
      { id: 'b', name: 'gn/43 - release', path: '/b', available: false },
    ];
    expect(ids({ rows, localBuilds })[0]).toEqual([
      'local',
      ['gn/main - testing', 'gn/43 - release'],
    ]);
    expect(ids({ rows, localBuilds, query: '43' })).toEqual([
      [
        'results',
        [
          'gn/43 - release',
          '43.0.0',
          '43.0.0-beta.1',
          '43.0.0-alpha.2',
          '43.0.0-nightly.20260101',
        ],
      ],
    ]);
  });

  it('matches "Electron 42", "v42" and any case', () => {
    for (const query of ['Electron 42', 'v42', 'ELECTRON 42.4', ' 42.4.1 ']) {
      expect(ids({ rows, query }), query).toEqual([['results', ['42.4.1']]]);
    }
    expect(normalizeVersionQuery('  Electron v43 ')).toBe('43');
  });

  it('is empty when nothing matches', () => {
    expect(groups({ rows, query: '99' })).toEqual([]);
  });

  it('follows the version settings but always keeps the current version', () => {
    const settings = {
      channels: ['stable' as const],
      showObsolete: false,
      showNotDownloaded: false,
    };
    const installs: VersionsState['installs'] = { '42.4.1': { state: 'installed' } };
    const withObsolete = [...rows, row('30.0.0', { obsolete: true })];
    expect(ids({ rows: withObsolete, settings, installs })).toEqual([
      ['stable', ['42.4.1']],
    ]);
    expect(
      ids({
        rows: withObsolete,
        settings,
        installs,
        current: { kind: 'release', version: '44.0.0-beta.3' },
      }),
    ).toEqual([
      ['stable', ['42.4.1']],
      ['prerelease', ['44.0.0-beta.3']],
    ]);
  });

  it('lists versions this computer cannot run, disabled', () => {
    const [group] = groups({ rows: [row('10.0.0', { supported: false })] });
    expect(group?.entries[0]).toMatchObject({
      label: '10.0.0',
      state: 'unsupported',
      disabled: true,
    });
  });

  it('shows install state and the design hints', () => {
    const installs: VersionsState['installs'] = {
      '43.0.0': { state: 'installed' },
      '42.4.1': { state: 'downloading', percent: 42 },
      '43.0.0-beta.1': { state: 'installing' },
    };
    const localBuilds: LocalBuild[] = [
      { id: 'a', name: 'ok', path: '/a', available: true },
      { id: 'b', name: 'gone', path: '/b', available: false },
    ];
    const entries = groups({ rows, installs, localBuilds }).flatMap((g) => g.entries);
    const byLabel = Object.fromEntries(entries.map((e) => [e.label, e]));
    expect(byLabel['43.0.0']).toMatchObject({
      id: 'r:43.0.0',
      state: 'installed',
      hint: 'latest',
      disabled: false,
    });
    expect(byLabel['42.4.1']).toMatchObject({ state: 'downloading', percent: 42 });
    expect(byLabel['42.4.1']?.hint).toBeUndefined();
    expect(byLabel['43.0.0-beta.1']).toMatchObject({ state: 'installing', hint: 'beta' });
    expect(byLabel['43.0.0-alpha.2']).toMatchObject({ state: 'missing', hint: 'beta' });
    expect(byLabel['43.0.0-nightly.20260101']).toMatchObject({ hint: 'nightly' });
    expect(byLabel['ok']).toMatchObject({ id: 'l:a', state: 'local', disabled: false });
    expect(byLabel['gone']).toMatchObject({ state: 'localMissing', disabled: true });
  });
});
