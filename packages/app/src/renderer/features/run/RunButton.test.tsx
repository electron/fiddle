import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultSettings, type Keybindings } from '../../../shared/settings';
import type { AppState, WindowState } from '../../../shared/stores';

const mocks = vi.hoisted(() => ({
  app: {} as AppState,
  win: {} as WindowState,
  RunCommand: vi.fn((_id: string) => Promise.resolve()),
  showToast: vi.fn(),
}));

vi.mock('../../../ipc/renderer', () => ({
  windowApi: { RunCommand: mocks.RunCommand },
}));
vi.mock('../../../ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../ui')>()),
  showToast: mocks.showToast,
}));
vi.mock('../../state', () => ({
  useAppState: () => mocks.app,
  useWindowState: () => mocks.win,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { RunButton } from './RunButton';

const setup = (keybindings: Keybindings) => {
  mocks.app = {
    platform: 'linux',
    settings: { ...defaultSettings, keybindings },
  } as unknown as AppState;
  mocks.win = {
    rev: 1,
    run: { status: 'ready', errors: [], clearedSeq: 0, bisect: null },
    fiddle: { versionRef: { kind: 'release', version: '44.0.0' } },
  } as unknown as WindowState;
};

beforeEach(() => vi.clearAllMocks());

describe('RunButton', () => {
  it('shows the shortcut Run has, including one the user rebound', () => {
    setup({});
    const { unmount } = render(<RunButton />);
    expect(screen.getByRole('button', { name: /run/ }).textContent).toContain('Ctrl+R');
    unmount();

    setup({ 'run.toggle': 'Ctrl+Enter' });
    render(<RunButton />);
    expect(screen.getByRole('button', { name: /run/ }).textContent).toContain(
      'Ctrl+Enter',
    );
  });

  it('shows no shortcut once Run is unbound, and none in the compact title bar', () => {
    setup({ 'run.toggle': null });
    const { unmount } = render(<RunButton />);
    expect(screen.getByRole('button', { name: /run/ }).textContent).toBe('run');
    unmount();

    setup({});
    render(<RunButton compact />);
    expect(screen.getByRole('button', { name: /run/ }).textContent).toBe('run');
  });

  it('shows the pre-run checks at once, runs the toggle command, and is Run again when that fails', async () => {
    setup({});
    mocks.RunCommand.mockRejectedValueOnce(new Error('no version'));
    render(<RunButton />);
    fireEvent.click(screen.getByRole('button', { name: /run/ }));
    expect(mocks.RunCommand).toHaveBeenCalledWith('run.toggle');
    expect(screen.getByRole('button').textContent).toContain('checking');
    await waitFor(() =>
      expect(mocks.showToast).toHaveBeenCalledWith({
        tone: 'error',
        title: 'no version',
      }),
    );
    expect(screen.getByRole('button', { name: /run/ }).textContent).toContain('run');
  });

  it('stops a running fiddle with the same command', () => {
    setup({});
    mocks.win = {
      ...mocks.win,
      run: { ...mocks.win.run, status: 'running', version: '44.0.0' },
    } as WindowState;
    render(<RunButton />);
    fireEvent.click(screen.getByRole('button', { name: /stop/ }));
    expect(mocks.RunCommand).toHaveBeenCalledWith('run.toggle');
    expect(screen.getByRole('status').textContent).toBe('announceRunning');
  });
});
