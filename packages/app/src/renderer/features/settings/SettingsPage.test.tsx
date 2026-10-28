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
    ImportTheme: vi.fn(() => Promise.resolve(null)),
    CreateTheme: vi.fn((_from: unknown) => Promise.resolve('my-theme')),
    OpenThemesFolder: vi.fn(() => Promise.resolve()),
  },
  appPlatformApi: {
    Relaunch: vi.fn(() => Promise.resolve()),
    ResetPrivacyPermissions: vi.fn(() => Promise.resolve(true)),
  },
  RunCommand: vi.fn((_id: string) => Promise.resolve()),
  setView: vi.fn((_view: string, _errorTitle: string) => Promise.resolve(true)),
  versionRef: { kind: 'release', version: '44.0.0' } as { kind: string; version: string },
  app: {} as Record<string, unknown>,
  showToast: vi.fn(),
  // Enough of i18next to announce a language change and to word text in that language.
  i18n: (() => {
    const listeners = new Set<(language: string) => void>();
    return {
      listeners,
      on: (_event: string, listener: (language: string) => void) =>
        listeners.add(listener),
      off: (_event: string, listener: (language: string) => void) =>
        listeners.delete(listener),
      getFixedT: (language: string) => (key: string) => `${language}:${key}`,
      switchTo: (language: string) => listeners.forEach((listener) => listener(language)),
    };
  })(),
  t: (key: string) => key,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mocks.t, i18n: mocks.i18n }),
}));

vi.mock('../../../ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../ui')>()),
  showToast: mocks.showToast,
}));
vi.mock('../../../ipc/renderer', () => ({
  settingsApi: mocks.settingsApi,
  appPlatformApi: mocks.appPlatformApi,
  windowApi: { RunCommand: mocks.RunCommand },
}));
vi.mock('../../state', () => ({
  useAppState: () => mocks.app,
  useWindowState: () => ({ fiddle: { versionRef: mocks.versionRef } }),
}));
vi.mock('../gists/GitHubAccountSection', () => ({ GitHubAccountSection: () => null }));
vi.mock('../versions/VersionManager', () => ({ VersionManager: () => null }));
vi.mock('../../shell/window-state', () => ({ setView: mocks.setView }));
vi.mock('../../shell/theme-snapshot', () => ({
  currentThemeSnapshot: () => ({ snapshot: true }),
}));

import { openSettingsSection } from './sections';
import { SettingsPage } from './SettingsPage';

// `t` returns the key, so text below is keys.
// Pending changes outlive a test (they are per window), so each test starts at a later store rev, which drops them.
let storeRev = 0;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.i18n.listeners.clear();
  mocks.versionRef = { kind: 'release', version: '44.0.0' };
  storeRev += 10;
  mocks.settingsApi.SetSetting.mockImplementation(() => Promise.resolve(storeRev + 1));
  mocks.settingsApi.ResetSetting.mockImplementation(() => Promise.resolve(storeRev + 1));
  mocks.app = {
    rev: storeRev,
    locale: 'en',
    platform: 'linux',
    about: { name: 'Fiddle', version: '1.0.0', electron: '44.0.0' },
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

  it('goes back to the editor on Escape, unless a popup that is open takes it', () => {
    render(<SettingsPage />);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(mocks.setView).toHaveBeenCalledWith('editor', 'actionFailed');

    mocks.setView.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /^(?!reset).*locale\.title/ }));
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    expect(mocks.setView).not.toHaveBeenCalled();
  });

  it('opens, imports and exports settings.json, and says when that fails', async () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'openFile' }));
    fireEvent.click(screen.getByRole('button', { name: 'import' }));
    expect(mocks.settingsApi.OpenSettingsFile).toHaveBeenCalledTimes(1);
    expect(mocks.settingsApi.ImportSettings).toHaveBeenCalledTimes(1);

    mocks.settingsApi.ExportSettings.mockRejectedValueOnce(new Error('disk full'));
    fireEvent.click(screen.getByRole('button', { name: 'export' }));
    await waitFor(() =>
      expect(mocks.showToast).toHaveBeenCalledWith({
        tone: 'error',
        title: 'actionFailed',
        description: 'disk full',
      }),
    );
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

  it('offers the relaunch, worded in the new language, once the language has switched', async () => {
    render(<SettingsPage />);
    pickLanguage();
    await waitFor(() =>
      expect(mocks.settingsApi.SetSetting).toHaveBeenCalledWith('locale', 'de'),
    );
    await act(async () => {});
    expect(mocks.showToast).not.toHaveBeenCalled();

    act(() => mocks.i18n.switchTo('de'));
    expect(mocks.showToast).toHaveBeenCalledTimes(1);
    expect(mocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'de:locale.relaunchTitle',
        description: 'de:locale.relaunchDescription',
        actionLabel: 'de:locale.relaunch',
      }),
    );
    expect(mocks.i18n.listeners.size).toBe(0);
  });

  it('offers no relaunch for a choice that switches nothing, and only one for the next choice', async () => {
    render(<SettingsPage />);
    pickLanguage();
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: /^(?!reset).*locale\.title/ }));
    fireEvent.click(screen.getByRole('option', { name: 'English' }));
    await act(async () => {});
    expect(mocks.i18n.listeners.size).toBe(1);

    act(() => mocks.i18n.switchTo('en'));
    expect(mocks.showToast).toHaveBeenCalledTimes(1);
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
    expect(mocks.i18n.listeners.size).toBe(0);
    act(() => mocks.i18n.switchTo('de'));
    expect(mocks.showToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('relaunchTitle') }),
    );
  });
});

describe('Appearance and theme settings', () => {
  const themeSelect = () =>
    screen.getByRole('button', { name: /^(?!reset).*theme\.title/ });

  it('sets light or dark, unless the theme decides that', () => {
    const view = render(<SettingsPage />);
    fireEvent.click(screen.getByRole('radio', { name: 'appearance.dark' }));
    expect(mocks.settingsApi.SetSetting).toHaveBeenCalledWith('appearance', 'dark');
    view.unmount();

    mocks.app = {
      ...mocks.app,
      themes: [{ id: 'nord', name: 'Nord', isDark: true }],
      settings: { ...defaultSettings, theme: 'nord' },
    };
    render(<SettingsPage />);
    expect(
      (screen.getByRole('radio', { name: 'appearance.dark' }) as HTMLInputElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByText('appearance.fromTheme')).toBeTruthy();
  });

  it('lists the built-in, high-contrast and custom themes, and a missing one by its id', () => {
    mocks.app = {
      ...mocks.app,
      themes: [{ id: 'nord', name: 'Nord', isDark: true }],
      settings: { ...defaultSettings, theme: 'deleted-theme' },
    };
    render(<SettingsPage />);
    expect(themeSelect().textContent).toContain('deleted-theme');
    fireEvent.click(themeSelect());
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'theme.lucent',
      'theme.highContrastDark',
      'theme.highContrastLight',
      expect.stringContaining('Nord'),
      'deleted-theme',
    ]);
    fireEvent.click(screen.getByRole('option', { name: /Nord/ }));
    expect(mocks.settingsApi.SetSetting).toHaveBeenCalledWith('theme', 'nord');
  });

  it('imports a Monaco theme, starts a new one from the current look, and opens the folder', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'theme.importMonaco' }));
    fireEvent.click(screen.getByRole('button', { name: 'theme.create' }));
    fireEvent.click(screen.getByRole('button', { name: 'theme.openFolder' }));
    expect(mocks.settingsApi.ImportTheme).toHaveBeenCalledTimes(1);
    // On the built-in theme the new file starts from what is on screen; on a custom one main copies that.
    expect(mocks.settingsApi.CreateTheme).toHaveBeenCalledWith({ snapshot: true });
    expect(mocks.settingsApi.OpenThemesFolder).toHaveBeenCalledTimes(1);
  });

  it('starts a new theme from the custom theme in use', () => {
    mocks.app = {
      ...mocks.app,
      themes: [{ id: 'nord', name: 'Nord', isDark: true }],
      settings: { ...defaultSettings, theme: 'nord' },
    };
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'theme.create' }));
    expect(mocks.settingsApi.CreateTheme).toHaveBeenCalledWith(null);
  });

  it('relaunches from the language toast', async () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: /^(?!reset).*locale\.title/ }));
    fireEvent.click(screen.getByRole('option', { name: 'Deutsch' }));
    await waitFor(() => expect(mocks.i18n.listeners.size).toBe(1));
    act(() => mocks.i18n.switchTo('de'));
    const toast = mocks.showToast.mock.calls[0]![0] as { onAction: () => void };
    toast.onAction();
    expect(mocks.appPlatformApi.Relaunch).toHaveBeenCalledTimes(1);
  });
});

describe('Section controls', () => {
  const open = (section: string) => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: `section.${section}` }));
  };

  it("turns release channels on and off, but never the current version's", () => {
    mocks.versionRef = { kind: 'release', version: '45.0.0-beta.3' };
    mocks.app = {
      ...mocks.app,
      settings: { ...defaultSettings, channels: ['stable', 'beta'] },
    };
    open('electron');
    const box = (name: string) =>
      screen.getByRole('checkbox', { name }) as HTMLInputElement;
    expect(box('channel.beta').disabled).toBe(true);
    expect(box('channel.stable').disabled).toBe(false);

    fireEvent.click(box('channel.nightly'));
    expect(mocks.settingsApi.SetSetting).toHaveBeenCalledWith('channels', [
      'stable',
      'beta',
      'nightly',
    ]);
    fireEvent.click(box('channel.stable'));
    expect(mocks.settingsApi.SetSetting).toHaveBeenLastCalledWith('channels', [
      'beta',
      'nightly',
    ]);
  });

  it('picks a download mirror, and asks for the URLs of a custom one', () => {
    open('electron');
    expect(
      screen.queryByRole('textbox', { name: 'customMirrorElectron.title' }),
    ).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'mirror.custom' }));
    expect(mocks.settingsApi.SetSetting).toHaveBeenCalledWith('mirror', 'custom');
    expect(
      screen.getByRole('textbox', { name: 'customMirrorElectron.title' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('textbox', { name: 'customMirrorNightly.title' }),
    ).toBeTruthy();
  });

  it('shows the app and Electron versions and the contributors', async () => {
    open('about');
    expect(await screen.findByText(/1\.0\.0/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'about.contributors' })).toBeTruthy();
    expect(screen.getAllByRole('link').length).toBeGreaterThan(0);
  });

  it('resets the macOS privacy permissions and confirms it', async () => {
    mocks.app = { ...mocks.app, platform: 'darwin' };
    open('privacy');
    fireEvent.click(screen.getByRole('button', { name: 'privacyReset.button' }));
    await waitFor(() =>
      expect(mocks.showToast).toHaveBeenCalledWith({
        tone: 'success',
        title: 'privacyReset.done',
      }),
    );
    expect(mocks.appPlatformApi.ResetPrivacyPermissions).toHaveBeenCalledTimes(1);
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

  it('sends a typed value when the page closes under the field', () => {
    const view = render(<SettingsPage />);
    fireEvent.change(editorField('editorFontFamily.title'), {
      target: { value: 'Menlo' },
    });
    expect(mocks.settingsApi.SetSetting).not.toHaveBeenCalled();
    view.unmount();
    expect(mocks.settingsApi.SetSetting).toHaveBeenCalledWith(
      'editorFontFamily',
      'Menlo',
    );
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
