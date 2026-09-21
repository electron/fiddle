import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultSettings } from '../../../shared/settings';
import type { AppState, ReleaseRow, RunState } from '../../../shared/stores';

const mocks = vi.hoisted(() => ({
  command: undefined as ((id: string) => void) | undefined,
  rows: [] as ReleaseRow[],
  toastError: vi.fn(),
  runApi: {
    StartBisect: vi.fn((_good: string, _bad: string, _auto: boolean) =>
      Promise.resolve(),
    ),
    BisectGood: vi.fn(() => Promise.resolve()),
    BisectBad: vi.fn(() => Promise.resolve()),
    BisectSkip: vi.fn(() => Promise.resolve()),
    StopBisect: vi.fn(() => Promise.resolve()),
    OpenBisectCompare: vi.fn(() => Promise.resolve()),
  },
  app: {
    showNotDownloaded: true,
    installs: {} as Record<string, { state: string }>,
  },
}));

vi.mock('../../../ipc/renderer', () => ({
  runApi: mocks.runApi,
  windowApi: {
    onCommand: (handler: (id: string) => void) => {
      mocks.command = handler;
      return () => undefined;
    },
  },
}));
vi.mock('../../state', () => ({
  useAppState: () =>
    ({
      settings: {
        ...defaultSettings,
        channels: ['stable'],
        showNotDownloaded: mocks.app.showNotDownloaded,
      },
      versions: { installs: mocks.app.installs },
    }) as unknown as AppState,
}));
vi.mock('../run/use-run', () => ({ useReleases: () => mocks.rows }));
vi.mock('../../toast-error', () => ({ toastError: mocks.toastError }));

import { BisectControls, BisectDialogs } from './Bisect';

const release = (version: string): ReleaseRow => ({
  version,
  date: '',
  node: '',
  obsolete: false,
  supported: true,
});
const run = (bisect: RunState['bisect']) =>
  ({ status: 'ready', bisect }) as unknown as RunState;
const midway = {
  good: '40.0.0',
  bad: '44.0.0',
  auto: false,
  current: '42.0.0',
  result: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.app.showNotDownloaded = true;
  mocks.app.installs = {};
  mocks.rows = ['44.0.0', '43.0.0', '42.0.0', '41.0.0', '40.0.0'].map(release);
});

describe('BisectControls', () => {
  it('offers only Cancel while the first version is not chosen or an automatic bisect runs', () => {
    const { rerender, container } = render(
      <BisectControls run={run({ ...midway, current: null })} />,
    );
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'cancel',
    ]);
    rerender(<BisectControls run={run({ ...midway, auto: true })} />);
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'cancel',
    ]);
    expect(container.textContent).toContain('bisectAutoRunning');
    rerender(
      <BisectControls
        run={run({ ...midway, result: { good: '41.0.0', bad: '42.0.0' } })}
      />,
    );
    expect(container.textContent).toBe('');
  });
});

describe('BisectControls verdicts', () => {
  it('marks the version under test good, bad or skipped, or cancels the bisect', async () => {
    render(<BisectControls run={run(midway)} />);
    expect(screen.getByText(/bisectTesting/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'bisectGood' }));
    fireEvent.click(screen.getByRole('button', { name: 'bisectBad' }));
    fireEvent.click(screen.getByRole('button', { name: 'bisectSkip' }));
    expect(mocks.runApi.BisectGood).toHaveBeenCalledTimes(1);
    expect(mocks.runApi.BisectBad).toHaveBeenCalledTimes(1);
    expect(mocks.runApi.BisectSkip).toHaveBeenCalledTimes(1);

    const failure = new Error('no bisect running');
    mocks.runApi.StopBisect.mockRejectedValueOnce(failure);
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    await vi.waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(failure, 'bisectFailed'),
    );
  });
});

describe('the result dialog', () => {
  const done = run({
    ...midway,
    current: null,
    result: { good: '41.0.0', bad: '42.0.0' },
  });

  it('names the last good and first bad version and opens their comparison', () => {
    render(<BisectDialogs run={done} />);
    const dialog = screen.getByRole('dialog', { name: 'bisectDoneTitle' });
    expect(dialog.textContent).toContain('v41.0.0...v42.0.0');
    fireEvent.click(screen.getByRole('button', { name: 'openCompare' }));
    expect(mocks.runApi.OpenBisectCompare).toHaveBeenCalledTimes(1);
  });

  it('ends the bisect when closed, from the button or Escape', async () => {
    render(<BisectDialogs run={done} />);
    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await vi.waitFor(() => expect(mocks.runApi.StopBisect).toHaveBeenCalledTimes(2));
  });
});

describe('the range dialog', () => {
  it('offers only downloaded versions when the others are hidden', () => {
    mocks.app.showNotDownloaded = false;
    mocks.app.installs = {
      '43.0.0': { state: 'installed' },
      '41.0.0': { state: 'installed' },
    };
    render(<BisectDialogs run={run(null)} />);
    act(() => mocks.command?.('bisect.toggle'));
    fireEvent.click(screen.getByRole('button', { name: 'bisectStart' }));
    expect(mocks.runApi.StartBisect).toHaveBeenCalledWith('41.0.0', '43.0.0', false);
  });

  it('closes without starting from Cancel or Escape', async () => {
    render(<BisectDialogs run={run(null)} />);
    act(() => mocks.command?.('bisect.toggle'));
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => mocks.command?.('bisect.toggle'));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mocks.runApi.StartBisect).not.toHaveBeenCalled();
  });

  it('starts a bisect on the default range and closes', () => {
    render(<BisectDialogs run={run(null)} />);
    act(() => mocks.command?.('bisect.toggle'));
    fireEvent.click(screen.getByRole('button', { name: 'bisectStart' }));
    expect(mocks.runApi.StartBisect).toHaveBeenCalledWith('40.0.0', '44.0.0', false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows why main refused a range, after the dialog has closed', async () => {
    render(<BisectDialogs run={run(null)} />);
    act(() => mocks.command?.('bisect.toggle'));
    const refusal = new Error('too few versions');
    mocks.runApi.StartBisect.mockRejectedValueOnce(refusal);
    fireEvent.click(screen.getByRole('button', { name: 'bisectAuto' }));
    await vi.waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(refusal, 'bisectFailed'),
    );
    expect(mocks.runApi.StartBisect).toHaveBeenCalledWith('40.0.0', '44.0.0', true);
  });
});
