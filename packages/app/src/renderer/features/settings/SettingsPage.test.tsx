import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultSettings } from '../../../shared/settings';

const mocks = vi.hoisted(() => ({
  settingsApi: {
    SetSetting: vi.fn<(key: string, value: unknown) => Promise<number>>(() =>
      Promise.resolve(2),
    ),
    ResetSetting: vi.fn<(key: string) => Promise<number>>(() => Promise.resolve(2)),
    RefreshThemes: vi.fn(() => Promise.resolve(1)),
    OpenSettingsFile: vi.fn(() => Promise.resolve()),
    ImportSettings: vi.fn(() => Promise.resolve(null)),
    ExportSettings: vi.fn(() => Promise.resolve()),
  },
  app: {} as Record<string, unknown>,
  showToast: vi.fn(),
}));

vi.mock('../../../ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../ui')>()),
  showToast: mocks.showToast,
}));
vi.mock('../../../ipc/renderer', () => ({
  settingsApi: mocks.settingsApi,
  appApi: {
    GetAppInfo: () =>
      Promise.resolve({ name: 'Fiddle', version: '1.0.0', electronVersion: '44.0.0' }),
  },
  windowApi: { RunCommand: vi.fn(() => Promise.resolve()) },
}));
vi.mock('../../state', () => ({
  useAppState: () => mocks.app,
  useWindowState: () => ({
    fiddle: { versionRef: { kind: 'release', version: '44.0.0' } },
  }),
}));
vi.mock('../gists/GitHubAccountSection', () => ({ GitHubAccountSection: () => null }));
vi.mock('../versions/VersionManager', () => ({ VersionManager: () => null }));
vi.mock('../../shell/window-state', () => ({ setView: vi.fn() }));

import { openSettingsSection } from './sections';
import { SettingsPage } from './SettingsPage';

// Without an i18next instance, `t` returns the key, so text below is keys.
// Pending changes outlive a test (they are per window), so each test starts at a later store rev, which drops them.
let storeRev = 0;

beforeEach(() => {
  vi.clearAllMocks();
  storeRev += 10;
  mocks.settingsApi.SetSetting.mockImplementation(() => Promise.resolve(storeRev + 1));
  mocks.settingsApi.ResetSetting.mockImplementation(() => Promise.resolve(storeRev + 1));
  mocks.app = {
    rev: storeRev,
    locale: 'en',
    platform: 'linux',
    settings: { ...defaultSettings, packageManager: 'yarn' },
    themes: [],
    screenReaderActive: false,
    storageNotices: [],
  };
});

describe('SettingsPage', () => {
  it('opens on General', () => {
    render(<SettingsPage />);
    expect(screen.getByRole('heading', { name: 'section.general' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'section.execution' })).toBeNull();
    expect(mocks.settingsApi.RefreshThemes).toHaveBeenCalled();
  });

  it('searches every section by title, description and key', () => {
    render(<SettingsPage />);
    fireEvent.change(screen.getByRole('textbox', { name: 'search' }), {
      target: { value: 'packagemanager' },
    });
    expect(screen.getByRole('heading', { name: 'section.execution' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'section.general' })).toBeNull();
    expect(document.querySelector('[data-setting="packageManager"]')).toBeTruthy();
    expect(document.querySelector('[data-setting="socketFirewall"]')).toBeNull();

    fireEvent.change(screen.getByRole('textbox', { name: 'search' }), {
      target: { value: 'zzz' },
    });
    expect(screen.getByText('noResults')).toBeTruthy();
  });

  it('finds the macOS privacy reset row, and only on macOS', () => {
    const search = () =>
      fireEvent.change(screen.getByRole('textbox', { name: 'search' }), {
        target: { value: 'privacyReset' },
      });
    const view = render(<SettingsPage />);
    search();
    expect(screen.getByText('noResults')).toBeTruthy();
    view.unmount();

    mocks.app = { ...mocks.app, platform: 'darwin' };
    render(<SettingsPage />);
    search();
    expect(screen.getByRole('heading', { name: 'section.privacy' })).toBeTruthy();
    expect(screen.getByText('privacyReset.button')).toBeTruthy();
  });

  it('marks changed values and resets them', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'section.execution' }));
    const row = document.querySelector('[data-setting="packageManager"]')!;
    expect(row.querySelector('[aria-label="modified"]')).toBeTruthy();
    expect(
      document.querySelector('[data-setting="socketFirewall"] [aria-label="modified"]'),
    ).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'reset packageManager.title' }));
    expect(mocks.settingsApi.ResetSetting).toHaveBeenCalledWith('packageManager');
  });

  it('applies a change at once and sends it to main', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'section.execution' }));
    const toggle = screen.getByRole('switch', { name: 'socketFirewall.title' });
    expect((toggle as HTMLInputElement).checked).toBe(true);
    fireEvent.click(toggle);
    expect(mocks.settingsApi.SetSetting).toHaveBeenCalledWith('socketFirewall', false);
    expect(
      (screen.getByRole('switch', { name: 'socketFirewall.title' }) as HTMLInputElement)
        .checked,
    ).toBe(false);
  });
});

describe('SettingsPage opened at a section', () => {
  it('follows a request made while the page is already open, and forgets it afterwards', () => {
    const view = render(<SettingsPage />);
    expect(screen.getByRole('heading', { name: 'section.general' })).toBeTruthy();

    act(() => void openSettingsSection('privacy', 'failed'));
    expect(screen.getByRole('heading', { name: 'section.privacy' })).toBeTruthy();

    view.unmount();
    render(<SettingsPage />);
    expect(screen.getByRole('heading', { name: 'section.general' })).toBeTruthy();
  });

  it('opens at the requested section', () => {
    act(() => void openSettingsSection('keybindings', 'failed'));
    render(<SettingsPage />);
    expect(screen.getByRole('heading', { name: 'section.keybindings' })).toBeTruthy();
  });
});

describe('General settings', () => {
  it('renders when settings.json holds a locale that is not a valid language tag', () => {
    mocks.app = { ...mocks.app, settings: { ...defaultSettings, locale: 'en-12' } };
    render(<SettingsPage />);
    expect(screen.getByRole('heading', { name: 'section.general' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /^(?!reset).*locale\.title/ }).textContent,
    ).toContain('en-12');
  });

  const pickLanguage = () => {
    fireEvent.click(screen.getByRole('button', { name: /^(?!reset).*locale\.title/ }));
    fireEvent.click(screen.getByRole('option', { name: 'Deutsch' }));
  };

  it('names each real language in itself, and offers no pseudo-locales', () => {
    mocks.app = { ...mocks.app, locale: 'ja' };
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: /^(?!reset).*locale\.title/ }));
    const names = screen.getAllByRole('option').map((option) => option.textContent);
    expect(names).toEqual(
      expect.arrayContaining(['locale.system', 'English', 'Deutsch', '日本語']),
    );
    expect(names.some((name) => /Pseudo|XA|XB/.test(name ?? ''))).toBe(false);
  });

  it('offers the relaunch once main has accepted the language', async () => {
    render(<SettingsPage />);
    pickLanguage();
    await waitFor(() =>
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'locale.relaunchTitle' }),
      ),
    );
    expect(mocks.settingsApi.SetSetting).toHaveBeenCalledWith('locale', 'de');
  });

  it('does not offer the relaunch when main rejects the language', async () => {
    mocks.settingsApi.SetSetting.mockRejectedValue(new Error('nope'));
    render(<SettingsPage />);
    pickLanguage();
    await waitFor(() =>
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'nope' }),
      ),
    );
    expect(mocks.showToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'locale.relaunchTitle' }),
    );
  });
});

describe('Text and list settings', () => {
  const editorField = (name: string) => {
    fireEvent.click(screen.getByRole('button', { name: 'section.editor' }));
    return screen.getByRole('textbox', { name });
  };

  it('sends the font size as a number, or null when cleared, and never an invalid one', () => {
    render(<SettingsPage />);
    const field = editorField('editorFontSize.title');

    fireEvent.change(field, { target: { value: 'big' } });
    fireEvent.blur(field);
    expect(mocks.settingsApi.SetSetting).not.toHaveBeenCalled();
    expect(screen.getByText('editorFontSize.invalid')).toBeTruthy();

    fireEvent.change(field, { target: { value: '14' } });
    fireEvent.blur(field);
    expect(mocks.settingsApi.SetSetting).toHaveBeenCalledWith('editorFontSize', 14);
    expect(screen.queryByText('editorFontSize.invalid')).toBeNull();

    fireEvent.change(field, { target: { value: '' } });
    fireEvent.blur(field);
    expect(mocks.settingsApi.SetSetting).toHaveBeenLastCalledWith('editorFontSize', null);
  });

  it('holds an invalid environment variable back and sends the valid list', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'section.execution' }));
    const add = () =>
      fireEvent.click(
        document.querySelector(
          '[data-setting="environmentVariables"] button:last-child',
        )!,
      );
    add();
    const field = () =>
      within(document.querySelector('[data-setting="environmentVariables"]')!).getByRole(
        'textbox',
      );

    fireEvent.change(field(), { target: { value: 'not valid' } });
    fireEvent.blur(field());
    expect(mocks.settingsApi.SetSetting).not.toHaveBeenCalled();
    expect(screen.getByText('environmentVariables.invalid')).toBeTruthy();

    fireEvent.change(field(), { target: { value: 'DEBUG=1' } });
    fireEvent.blur(field());
    expect(mocks.settingsApi.SetSetting).toHaveBeenCalledWith('environmentVariables', [
      'DEBUG=1',
    ]);
  });
});

describe('Text settings', () => {
  it('commits on Enter, but not while an input method is composing', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'section.editor' }));
    const field = screen.getByRole('textbox', { name: 'editorFontFamily.title' });
    fireEvent.change(field, { target: { value: 'Fira Code' } });

    fireEvent.keyDown(field, { key: 'Enter', isComposing: true });
    expect(mocks.settingsApi.SetSetting).not.toHaveBeenCalled();

    fireEvent.keyDown(field, { key: 'Enter' });
    expect(mocks.settingsApi.SetSetting).toHaveBeenCalledWith(
      'editorFontFamily',
      'Fira Code',
    );
  });
});
