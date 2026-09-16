import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultSettings } from '../../../shared/settings';
import type { AppState, ReleaseRow, WindowState } from '../../../shared/stores';

const mocks = vi.hoisted(() => ({
  app: {} as AppState,
  win: {} as WindowState,
  rows: [] as ReleaseRow[],
  versionsApi: {
    SetVersion: vi.fn(() => Promise.resolve()),
    CopyVersion: vi.fn(() => Promise.resolve()),
    RetryDownload: vi.fn(() => Promise.resolve()),
    DismissNotice: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('../../../ipc/renderer', () => ({ versionsApi: mocks.versionsApi }));
vi.mock('../../state', () => ({
  useAppState: () => mocks.app,
  useWindowState: () => mocks.win,
}));
vi.mock('../run/use-run', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../run/use-run')>()),
  useReleases: () => mocks.rows,
}));
// `t` shows the key and its options, so interpolated text can be checked: "stateDownloading {"percent":5}".
const t = (key: string, options?: Record<string, unknown>) =>
  options ? `${key} ${JSON.stringify(options)}` : key;
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
vi.mock('../../../main/versions/releases', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../main/versions/releases')>();
  return { ...actual, pickerGroups: vi.fn(actual.pickerGroups) };
});

import { pickerGroups } from '../../../main/versions/releases';
import { VersionPicker } from './VersionPicker';

const row = (version: string): ReleaseRow => ({
  version,
  date: '',
  node: '',
  obsolete: false,
  supported: true,
});

/** A store push: main sends a whole new object every time. */
function push(change: (app: AppState) => void) {
  mocks.app = structuredClone(mocks.app);
  mocks.app.rev += 1;
  change(mocks.app);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rows = [row('44.3.0'), row('43.7.0'), row('42.11.3'), row('45.0.0-alpha.6')];
  mocks.app = {
    rev: 1,
    locale: 'en',
    platform: 'linux',
    material: 'none',
    settings: defaultSettings,
    themes: [],
    screenReaderActive: false,
    storageNotices: [],
    versions: {
      releasesRev: 1,
      installs: { '43.7.0': { state: 'downloading', percent: 5 } },
      localBuilds: [
        { id: 'gn', name: 'gn/main - testing', path: '/src/out', available: true },
      ],
      downloadingAll: false,
      arch: 'x64',
    },
  };
  mocks.win = {
    rev: 1,
    windowId: '00000000-0000-4000-8000-000000000000',
    title: 'Fiddle',
    view: 'editor',
    fiddle: { versionRef: { kind: 'release', version: '44.3.0' } },
    layout: {},
  } as WindowState;
});

const option = (id: string) =>
  document.querySelector(`[role="option"][data-key="${id}"]`);

describe('VersionPicker', () => {
  // @feature versions.picker versions.install-state
  it('lists local builds, stable releases and pre-releases with their install state', () => {
    render(<VersionPicker />);
    const trigger = screen.getByRole('button');
    expect(trigger.textContent).toContain('electronVersion {"version":"44.3.0"}');
    fireEvent.click(trigger);
    const names = screen.getAllByRole('option').map((o) => o.getAttribute('aria-label'));
    expect(names).toEqual([
      'gn/main - testing',
      'electronVersion {"version":"44.3.0"} hintLatest',
      'electronVersion {"version":"43.7.0"}',
      'electronVersion {"version":"42.11.3"}',
      'electronVersion {"version":"45.0.0-alpha.6"} hintBeta',
      'copyVersion',
    ]);
    expect(screen.getByText('groupLocal')).toBeTruthy();
    expect(screen.getByText('groupStable')).toBeTruthy();
    expect(screen.getByText('groupPrerelease')).toBeTruthy();
    expect(option('r:44.3.0')?.getAttribute('aria-selected')).toBe('true');
    expect(option('r:42.11.3')?.textContent).toContain('stateMissing');
    expect(option('l:gn')?.textContent).toContain('stateLocal');

    fireEvent.click(option('r:43.7.0')!);
    expect(mocks.versionsApi.SetVersion).toHaveBeenCalledWith({
      kind: 'release',
      version: '43.7.0',
    });
  });

  // @feature versions.download
  it('updates a downloading row in place: progress pushes do not rebuild the list', () => {
    const { rerender } = render(<VersionPicker />);
    fireEvent.click(screen.getByRole('button'));
    expect(option('r:43.7.0')?.textContent).toContain('stateDownloading {"percent":5}');
    const builds = vi.mocked(pickerGroups).mock.calls.length;

    // Ten of these a second while downloading: only the row's text changes.
    push(
      (app) => (app.versions!.installs['43.7.0'] = { state: 'downloading', percent: 42 }),
    );
    rerender(<VersionPicker />);
    expect(option('r:43.7.0')?.textContent).toContain('stateDownloading {"percent":42}');
    // An unrelated push changes nothing either.
    push((app) => (app.screenReaderActive = true));
    rerender(<VersionPicker />);
    expect(vi.mocked(pickerGroups).mock.calls.length).toBe(builds);

    // A state change does rebuild it.
    push((app) => (app.versions!.installs['43.7.0'] = { state: 'installed' }));
    rerender(<VersionPicker />);
    expect(option('r:43.7.0')?.textContent).toContain('stateInstalled');
    expect(vi.mocked(pickerGroups).mock.calls.length).toBe(builds + 1);
  });
});
