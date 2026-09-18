import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultSettings } from '../../../shared/settings';

const mocks = vi.hoisted(() => ({
  onCommand: undefined as ((id: string) => void) | undefined,
  RunCommand: vi.fn<(id: string) => Promise<void>>(() => Promise.resolve()),
  SetVersion: vi.fn(() => Promise.resolve(1)),
  releases: [] as { version: string; supported: boolean }[],
}));

vi.mock('../../../ipc/renderer', () => ({
  windowApi: {
    RunCommand: mocks.RunCommand,
    onCommand: (listener: (id: string) => void) => {
      mocks.onCommand = listener;
      return () => undefined;
    },
  },
  documentsApi: {},
  versionsApi: { SetVersion: mocks.SetVersion },
}));
vi.mock('../../state', () => ({
  useAppState: () => ({
    platform: 'linux',
    dev: false,
    settings: defaultSettings,
    versions: { localBuilds: [] },
  }),
  useWindowState: () => null,
}));
vi.mock('../run/use-run', () => ({ useReleases: () => mocks.releases }));
vi.mock('../onboarding/OnboardingTour', () => ({ OnboardingTour: () => null }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { version?: string }) =>
      options?.version ? `${key} ${options.version}` : key,
  }),
}));

import { CommandPalette } from './CommandPalette';

const input = () => screen.getByRole('combobox', { name: 'label' });

async function openPalette(): Promise<HTMLElement> {
  act(() => mocks.onCommand!('app.commandPalette'));
  return await screen.findByRole('combobox', { name: 'label' });
}

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom has no layout, so no scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
  mocks.releases = [];
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('CommandPalette', () => {
  it('runs the highlighted command on Enter, after the overlay has closed', async () => {
    render(<CommandPalette />);
    await openPalette();
    fireEvent.change(input(), { target: { value: 'app.newWindow' } });
    fireEvent.keyDown(input(), { key: 'Enter' });

    await waitFor(() => expect(mocks.RunCommand).toHaveBeenCalledWith('app.newWindow'));
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(JSON.parse(localStorage.getItem('fiddle.palette.recent')!)).toEqual([
      'command:app.newWindow',
    ]);
  });

  it('leaves Enter and the arrows to an input method that is composing', async () => {
    render(<CommandPalette />);
    await openPalette();
    fireEvent.change(input(), { target: { value: 'app.newWindow' } });
    vi.stubGlobal('requestAnimationFrame', (frame: () => void) => {
      frame();
      return 0;
    });
    fireEvent.keyDown(input(), { key: 'Enter', isComposing: true });
    fireEvent.keyDown(input(), { key: 'ArrowDown', isComposing: true });
    await act(async () => undefined);

    expect(mocks.RunCommand).not.toHaveBeenCalled();
    expect(input()).toBeTruthy();
  });

  it('still runs the command when the recent list cannot be saved', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    render(<CommandPalette />);
    await openPalette();
    fireEvent.change(input(), { target: { value: 'app.newWindow' } });
    fireEvent.keyDown(input(), { key: 'Enter' });

    await waitFor(() => expect(mocks.RunCommand).toHaveBeenCalledWith('app.newWindow'));
  });

  it('lists Electron versions from the shared release list', async () => {
    mocks.releases = [
      { version: '44.0.1', supported: true },
      { version: '9.0.0', supported: false },
    ];
    render(<CommandPalette />);
    await openPalette();
    fireEvent.change(input(), { target: { value: '44.0.1' } });
    expect(screen.getByRole('option', { name: /electronVersion 44\.0\.1/ })).toBeTruthy();

    fireEvent.change(input(), { target: { value: '9.0.0' } });
    expect(screen.queryByRole('option', { name: /electronVersion/ })).toBeNull();
  });
});
