import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultSettings, type Keybindings } from '../../../shared/settings';
import type { AppState, WindowState } from '../../../shared/stores';

const mocks = vi.hoisted(() => ({ app: {} as AppState, win: {} as WindowState }));

vi.mock('../../../ipc/renderer', () => ({
  windowApi: { RunCommand: vi.fn(() => Promise.resolve()) },
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
});
