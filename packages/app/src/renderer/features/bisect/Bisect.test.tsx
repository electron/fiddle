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
      settings: { ...defaultSettings, channels: ['stable'] },
      versions: { installs: {} },
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

describe('the range dialog', () => {
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
