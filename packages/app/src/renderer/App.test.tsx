import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  app: {} as unknown,
  win: null as unknown,
  storeError: undefined as Error | undefined,
  synced: true,
  ReportReady: vi.fn(() => Promise.resolve()),
}));

vi.mock('../ipc/renderer', () => ({
  windowApi: {
    ReportReady: mocks.ReportReady,
    RunCommand: vi.fn(() => Promise.resolve()),
  },
  settingsApi: { GetTheme: vi.fn(() => Promise.resolve(null)) },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', dir: () => 'ltr' },
  }),
}));
vi.mock('../i18n/renderer', () => ({ useSyncLocale: () => undefined }));
vi.mock('./state', () => ({
  useAppState: () => mocks.app,
  useWindowState: () => mocks.win,
  useStoreError: () => mocks.storeError,
}));
vi.mock('./editor/models', () => ({ useModelsSynced: () => mocks.synced }));
vi.mock('./features/commands/keybindings', () => ({ useKeybindings: () => undefined }));
vi.mock('./features/commands/window-commands', () => ({
  useWindowCommands: () => undefined,
}));
vi.mock('./features/palette/CommandPalette', () => ({ CommandPalette: () => null }));
vi.mock('./features/settings/StorageNotices', () => ({ StorageNotices: () => null }));
vi.mock('./shell/theme', () => ({ useAppearance: () => undefined }));
vi.mock('./shell/Shell', () => ({ Shell: () => <p>the shell</p> }));

import { App } from './App';

const app = {
  material: 'none',
  locale: 'en',
  settings: { theme: 'lucent', appearance: 'system' },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('requestAnimationFrame', (frame: () => void) => {
    frame();
    return 0;
  });
  mocks.app = app;
  mocks.win = {};
  mocks.storeError = undefined;
  mocks.synced = true;
});

afterEach(() => vi.unstubAllGlobals());

describe('App', () => {
  it('reports ready once both stores and the editor text are in', () => {
    render(<App />);
    expect(screen.getByText('the shell')).toBeTruthy();
    expect(mocks.ReportReady).toHaveBeenCalledOnce();
  });

  it('holds back while the editor text is still loading', () => {
    mocks.synced = false;
    render(<App />);
    expect(mocks.ReportReady).not.toHaveBeenCalled();
  });

  it('reports ready and shows an error when a store fails to load, so the window is not left hidden', () => {
    mocks.app = undefined;
    mocks.win = null;
    mocks.storeError = new Error('bad store');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<App />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByText('the shell')).toBeNull();
    expect(mocks.ReportReady).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith(
      '[fiddle] a store failed to load',
      mocks.storeError,
    );
    error.mockRestore();
  });
});
