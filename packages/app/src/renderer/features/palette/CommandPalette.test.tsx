import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultSettings } from '../../../shared/settings';

const mocks = vi.hoisted(() => ({
  onCommand: undefined as ((id: string) => void) | undefined,
  RunCommand: vi.fn<(id: string) => Promise<void>>(() => Promise.resolve()),
  SetVersion: vi.fn((_ref: unknown) => Promise.resolve(1)),
  SetActiveFile: vi.fn((_name: string) => Promise.resolve(1)),
  LoadExample: vi.fn((_name: string) => Promise.resolve(1)),
  releases: [] as { version: string; supported: boolean }[],
  files: [] as { name: string; visible: boolean }[],
  localBuilds: [] as { id: string; name: string; available: boolean }[],
  showToast: vi.fn(),
}));

vi.mock('../../../ipc/renderer', () => ({
  windowApi: {
    RunCommand: mocks.RunCommand,
    onCommand: (listener: (id: string) => void) => {
      mocks.onCommand = listener;
      return () => undefined;
    },
  },
  documentsApi: { SetActiveFile: mocks.SetActiveFile, LoadExample: mocks.LoadExample },
  versionsApi: { SetVersion: mocks.SetVersion },
}));
vi.mock('../../state', () => ({
  useAppState: () => ({
    platform: 'linux',
    dev: false,
    settings: defaultSettings,
    versions: { localBuilds: mocks.localBuilds },
  }),
  useWindowState: () =>
    mocks.files.length > 0
      ? { fiddle: { files: mocks.files, source: { origin: 'local', trusted: true } } }
      : null,
}));
vi.mock('../../../ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../ui')>()),
  showToast: mocks.showToast,
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
import { setEditorActionProvider } from './editor-actions';

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
  mocks.files = [];
  mocks.localBuilds = [];
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setEditorActionProvider(undefined);
});

const selected = () => screen.getByRole('option', { selected: true }).textContent;
/** Picks the entry that `text` finds. */
async function pick(text: string): Promise<void> {
  await openPalette();
  fireEvent.change(input(), { target: { value: text } });
  fireEvent.click(screen.getAllByRole('option')[0]!);
  await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull());
}

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

  it('opens files, picks versions, runs editor actions and loads examples', async () => {
    mocks.files = [{ name: 'preload.js', visible: true }];
    mocks.localBuilds = [{ id: 'b1', name: 'Debug build', available: true }];
    mocks.releases = [{ version: '44.0.1', supported: true }];
    const format = vi.fn();
    setEditorActionProvider(() => [
      { id: 'format', label: 'Format document', run: format },
    ]);
    render(<CommandPalette />);

    await pick('preload.js');
    await waitFor(() => expect(mocks.SetActiveFile).toHaveBeenCalledWith('preload.js'));
    await pick('Debug build');
    await waitFor(() =>
      expect(mocks.SetVersion).toHaveBeenCalledWith({ kind: 'local', id: 'b1' }),
    );
    await pick('44.0.1');
    await waitFor(() =>
      expect(mocks.SetVersion).toHaveBeenCalledWith({
        kind: 'release',
        version: '44.0.1',
      }),
    );
    await pick('Format document');
    await waitFor(() => expect(format).toHaveBeenCalledTimes(1));
    await pick('BrowserWindow');
    await waitFor(() => expect(mocks.LoadExample).toHaveBeenCalledWith('BrowserWindow'));
  });

  it('moves the highlight with the arrow and page keys, wrapping at the ends, and with the pointer', async () => {
    render(<CommandPalette />);
    await openPalette();
    const options = screen.getAllByRole('option');
    expect(selected()).toBe(options[0]!.textContent);
    fireEvent.keyDown(input(), { key: 'ArrowUp' });
    expect(selected()).toBe(options.at(-1)!.textContent);
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    expect(selected()).toBe(options[1]!.textContent);
    fireEvent.keyDown(input(), { key: 'PageDown' });
    expect(selected()).toBe(options[9]!.textContent);
    fireEvent.keyDown(input(), { key: 'PageUp' });
    fireEvent.keyDown(input(), { key: 'PageUp' });
    expect(selected()).toBe(options[0]!.textContent);
    fireEvent.pointerMove(options[3]!);
    expect(selected()).toBe(options[3]!.textContent);
  });

  it('starts with no recent entries when the saved list is damaged', async () => {
    localStorage.setItem('fiddle.palette.recent', '{"not":"a list"}');
    render(<CommandPalette />);
    await openPalette();
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0);
  });

  it('says which entry failed to run', async () => {
    mocks.RunCommand.mockRejectedValueOnce(new Error('no window'));
    render(<CommandPalette />);
    await pick('app.newWindow');
    await waitFor(() =>
      expect(mocks.showToast).toHaveBeenCalledWith({
        tone: 'error',
        title: 'runFailed',
        description: 'no window',
      }),
    );
  });
});
