import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultSettings } from '../../../shared/settings';
import type { AppState, LocalBuild, ReleaseRow } from '../../../shared/stores';

const mocks = vi.hoisted(() => ({
  app: {} as AppState,
  rows: [] as ReleaseRow[],
  versionsApi: {
    Download: vi.fn((_version: string) => Promise.resolve()),
    Remove: vi.fn((_version: string) => Promise.resolve()),
    RemoveLocalBuild: vi.fn((_id: string) => Promise.resolve()),
    DownloadAll: vi.fn((_versions: string[]) => Promise.resolve()),
    StopDownloadAll: vi.fn(() => Promise.resolve()),
    RefreshReleases: vi.fn(() => Promise.resolve()),
    AddLocalBuild: vi.fn(() => Promise.resolve(null)),
    DeleteAll: vi.fn(() => Promise.resolve()),
  },
  confirmDialog: vi.fn(() => Promise.resolve(true)),
  showToast: vi.fn(),
}));

vi.mock('../../../ipc/renderer', () => ({ versionsApi: mocks.versionsApi }));
vi.mock('../../state', () => ({ useAppState: () => mocks.app }));
vi.mock('../run/use-run', () => ({ useReleases: () => mocks.rows }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { percent?: number }) =>
      options?.percent !== undefined ? `${key} ${options.percent}` : key,
  }),
}));
vi.mock('../../../ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../ui')>()),
  confirmDialog: mocks.confirmDialog,
  showToast: mocks.showToast,
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
  localBuilds: LocalBuild[] = [],
) =>
  ({
    rev: 1,
    settings: { ...defaultSettings, channels: ['stable', 'beta'] },
    versions: {
      releasesRev: 1,
      installs,
      localBuilds,
      downloadingAll,
      arch: 'x64',
    },
  }) as unknown as AppState;

const row = (version: string) =>
  screen.getByRole('cell', { name: version }).closest('tr')!;
const versionCells = () =>
  screen
    .getAllByRole('cell')
    .filter((cell) => cell === cell.closest('tr')!.querySelector('td'))
    .map((cell) => cell.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rows = releases(5);
  mocks.app = appWith({});
});

describe('VersionManager', () => {
  it('offers Download for a missing release and Remove for an installed one', () => {
    mocks.app = appWith({ '41.0.0': { state: 'installed' } });
    render(<VersionManager />);
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

  it("shows each release's install state, and downloads or removes it", async () => {
    mocks.rows = [...releases(4), { ...releases(5)[4]!, supported: false }];
    mocks.app = appWith({
      '40.0.0': { state: 'installed' },
      '41.0.0': { state: 'downloading', percent: 40 },
      '42.0.0': { state: 'installing' },
      '43.0.0': { state: 'downloaded' },
    });
    const view = render(<VersionManager />);
    const status = (version: string) =>
      row(version).querySelectorAll('td')[1]!.textContent;
    expect(status('40.0.0')).toBe('stateInstalled');
    expect(status('41.0.0')).toBe('stateDownloading 40');
    expect(status('42.0.0')).toBe('stateInstalling');
    expect(status('43.0.0')).toBe('stateDownloaded');
    expect(status('44.0.0')).toBe('stateUnsupported');
    // Nothing to do while a version installs, or for one this platform can't run.
    expect(within(row('42.0.0')).queryByRole('button')).toBeNull();
    expect(within(row('44.0.0')).queryByRole('button')).toBeNull();

    fireEvent.click(within(row('43.0.0')).getByRole('button', { name: 'remove' }));
    expect(mocks.versionsApi.Remove).toHaveBeenCalledWith('43.0.0');

    mocks.app = appWith({});
    view.rerender(<VersionManager />);
    mocks.versionsApi.Download.mockRejectedValueOnce(new Error('mirror down'));
    fireEvent.click(within(row('40.0.0')).getByRole('button', { name: 'download' }));
    expect(mocks.versionsApi.Download).toHaveBeenCalledWith('40.0.0');
    await waitFor(() =>
      expect(mocks.showToast).toHaveBeenCalledWith({
        tone: 'error',
        title: 'mirror down',
      }),
    );
  });

  it('lists local builds first, says when their folder is gone, and removes one', () => {
    mocks.app = appWith({}, false, [
      { id: 'b1', name: 'Debug build', path: '/e/out/D', available: true },
      { id: 'b2', name: 'Testing build', path: '/e/out/T', available: false },
    ]);
    render(<VersionManager />);
    expect(versionCells().slice(0, 3)).toEqual([
      'Debug build',
      'Testing build',
      '40.0.0',
    ]);
    expect(row('Debug build').textContent).toContain('stateLocal');
    expect(row('Testing build').textContent).toContain('stateLocalMissing');

    fireEvent.click(within(row('Testing build')).getByRole('button', { name: 'remove' }));
    expect(mocks.versionsApi.RemoveLocalBuild).toHaveBeenCalledWith('b2');

    // The filter matches build names too.
    fireEvent.change(screen.getByRole('textbox', { name: 'filterVersions' }), {
      target: { value: 'debug' },
    });
    expect(versionCells()).toEqual(['Debug build']);
  });

  it('narrows the list by channel and to downloaded versions', () => {
    mocks.rows = [
      ...releases(2),
      { ...releases(1)[0]!, version: '46.0.0-beta.2' },
      { ...releases(1)[0]!, version: '47.0.0-nightly.20260101' },
    ];
    mocks.app = appWith({ '41.0.0': { state: 'installed' } }, false);
    render(<VersionManager />);
    // The settings' channels are the starting point.
    expect(versionCells()).toEqual(['40.0.0', '41.0.0', '46.0.0-beta.2']);

    fireEvent.click(screen.getByRole('checkbox', { name: 'channelNightly' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'channelBeta' }));
    expect(versionCells()).toEqual(['40.0.0', '41.0.0', '47.0.0-nightly.20260101']);

    fireEvent.click(screen.getByRole('checkbox', { name: 'downloadedOnly' }));
    expect(versionCells()).toEqual(['41.0.0']);
  });

  it('refreshes the releases, adds a local build and stops a Download all', () => {
    render(<VersionManager />);
    fireEvent.click(screen.getByRole('button', { name: 'refreshReleases' }));
    fireEvent.click(screen.getByRole('button', { name: 'addLocalBuild' }));
    fireEvent.click(screen.getByRole('button', { name: 'stopDownloads' }));
    expect(mocks.versionsApi.RefreshReleases).toHaveBeenCalledTimes(1);
    expect(mocks.versionsApi.AddLocalBuild).toHaveBeenCalledTimes(1);
    expect(mocks.versionsApi.StopDownloadAll).toHaveBeenCalledTimes(1);
  });

  it('deletes every download only once the user confirms', async () => {
    mocks.confirmDialog.mockResolvedValueOnce(false);
    render(<VersionManager />);
    fireEvent.click(screen.getByRole('button', { name: 'deleteAll' }));
    await waitFor(() => expect(mocks.confirmDialog).toHaveBeenCalledTimes(1));
    expect(mocks.versionsApi.DeleteAll).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'deleteAll' }));
    await waitFor(() => expect(mocks.versionsApi.DeleteAll).toHaveBeenCalledTimes(1));
    expect(mocks.confirmDialog).toHaveBeenLastCalledWith(
      expect.objectContaining({ tone: 'danger', confirmLabel: 'deleteAll' }),
    );
  });
});
