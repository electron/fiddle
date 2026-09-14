import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultSettings } from '../../../shared/settings';

const mocks = vi.hoisted(() => ({
  settingsApi: {
    SetSetting: vi.fn(() => Promise.resolve(2)),
    ResetSetting: vi.fn(() => Promise.resolve(2)),
    RefreshThemes: vi.fn(() => Promise.resolve(1)),
    OpenSettingsFile: vi.fn(() => Promise.resolve()),
    ImportSettings: vi.fn(() => Promise.resolve(null)),
    ExportSettings: vi.fn(() => Promise.resolve()),
  },
  app: {} as Record<string, unknown>,
}));

vi.mock('../../../ipc/renderer', () => ({
  settingsApi: mocks.settingsApi,
  appApi: { GetAppInfo: () => Promise.resolve({ name: 'Fiddle', version: '1.0.0', electronVersion: '44.0.0' }) },
  windowApi: { RunCommand: vi.fn(() => Promise.resolve()) },
}));
vi.mock('../../state', () => ({
  useAppState: () => mocks.app,
  useWindowState: () => ({ fiddle: { versionRef: { kind: 'release', version: '44.0.0' } } }),
}));
vi.mock('../gists/GitHubAccountSection', () => ({ GitHubAccountSection: () => null }));
vi.mock('../versions/VersionManager', () => ({ VersionManager: () => null }));
vi.mock('../../shell/window-state', () => ({ setView: vi.fn() }));

import { SettingsPage } from './SettingsPage';

// Without an i18next instance, `t` returns the key, so text below is keys.
beforeEach(() => {
  vi.clearAllMocks();
  mocks.app = {
    rev: 1,
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

  // @feature new.settings-search
  it('searches every section by title, description and key', () => {
    render(<SettingsPage />);
    fireEvent.change(screen.getByRole('textbox', { name: 'search' }), { target: { value: 'packagemanager' } });
    expect(screen.getByRole('heading', { name: 'section.execution' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'section.general' })).toBeNull();
    expect(document.querySelector('[data-setting="packageManager"]')).toBeTruthy();
    expect(document.querySelector('[data-setting="socketFirewall"]')).toBeNull();

    fireEvent.change(screen.getByRole('textbox', { name: 'search' }), { target: { value: 'zzz' } });
    expect(screen.getByText('noResults')).toBeTruthy();
  });

  // @feature new.settings-reset
  it('marks changed values and resets them', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'section.execution' }));
    const row = document.querySelector('[data-setting="packageManager"]')!;
    expect(row.querySelector('[aria-label="modified"]')).toBeTruthy();
    expect(document.querySelector('[data-setting="socketFirewall"] [aria-label="modified"]')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'reset' }));
    expect(mocks.settingsApi.ResetSetting).toHaveBeenCalledWith('packageManager');
  });

  // @feature settings.socket-firewall
  it('applies a change at once and sends it to main', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'section.execution' }));
    const toggle = screen.getByRole('switch', { name: 'socketFirewall.title' });
    expect((toggle as HTMLInputElement).checked).toBe(true);
    fireEvent.click(toggle);
    expect(mocks.settingsApi.SetSetting).toHaveBeenCalledWith('socketFirewall', false);
    expect((screen.getByRole('switch', { name: 'socketFirewall.title' }) as HTMLInputElement).checked).toBe(false);
  });
});
