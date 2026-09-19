import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultSettings } from '../../../shared/settings';
import type { AppState, ReleaseRow } from '../../../shared/stores';

const mocks = vi.hoisted(() => ({
  app: {} as AppState,
  rows: [] as ReleaseRow[],
  versionsApi: {
    Download: vi.fn(() => Promise.resolve()),
    Remove: vi.fn(() => Promise.resolve()),
    DownloadAll: vi.fn((_versions: string[]) => Promise.resolve()),
  },
}));

vi.mock('../../../ipc/renderer', () => ({ versionsApi: mocks.versionsApi }));
vi.mock('../../state', () => ({ useAppState: () => mocks.app }));
vi.mock('../run/use-run', () => ({ useReleases: () => mocks.rows }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { VersionManager } from './VersionManager';

const releases = (count: number): ReleaseRow[] =>
  Array.from({ length: count }, (_, i) => ({
    version: `${40 + i}.0.0`,
    date: '',
    node: '',
    obsolete: false,
    supported: true,
  }));

const appWith = (
  installs: NonNullable<AppState['versions']>['installs'],
  downloadingAll = true,
) =>
  ({
    rev: 1,
    settings: { ...defaultSettings, channels: ['stable', 'beta'] },
    versions: {
      releasesRev: 1,
      installs,
      localBuilds: [],
      downloadingAll,
      arch: 'x64',
    },
  }) as unknown as AppState;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rows = releases(5);
  mocks.app = appWith({});
});

describe('VersionManager', () => {
  it('offers Download for a missing release and Remove for an installed one', () => {
    mocks.app = appWith({ '41.0.0': { state: 'installed' } });
    render(<VersionManager />);
    const row = (version: string) =>
      screen.getByRole('cell', { name: version }).closest('tr')!;
    expect(within(row('40.0.0')).getByRole('button', { name: 'download' })).toBeTruthy();
    expect(within(row('41.0.0')).getByRole('button', { name: 'remove' })).toBeTruthy();
  });

  it('downloads every matching version of a filter, not only the rows on screen', () => {
    mocks.rows = releases(250);
    mocks.app = appWith({}, false);
    render(<VersionManager />);
    fireEvent.change(screen.getByRole('textbox', { name: 'filterVersions' }), {
      target: { value: '.0.0' },
    });
    expect(screen.getAllByRole('cell', { name: /^\d+\.0\.0$/ })).toHaveLength(200);
    fireEvent.click(screen.getByRole('button', { name: 'downloadAll' }));
    expect(mocks.versionsApi.DownloadAll.mock.calls[0]?.[0]).toHaveLength(250);
  });

  it('offers no Download all until the list is filtered', () => {
    mocks.rows = releases(250);
    mocks.app = appWith({}, false);
    render(<VersionManager />);
    expect(screen.queryByRole('button', { name: 'downloadAll' })).toBeNull();
  });
});
