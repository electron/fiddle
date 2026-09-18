import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultSettings } from '../../../shared/settings';

const mocks = vi.hoisted(() => ({
  settingsApi: {
    SetSetting: vi.fn<(key: string, value: unknown) => Promise<number>>(() =>
      Promise.resolve(2),
    ),
    ResetSetting: vi.fn(() => Promise.resolve(2)),
  },
  app: {} as Record<string, unknown>,
}));

vi.mock('../../../ipc/renderer', () => ({ settingsApi: mocks.settingsApi }));
vi.mock('../../state', () => ({ useAppState: () => mocks.app }));

import { KeybindingsSection } from './KeybindingsSection';

const row = () => document.querySelector<HTMLElement>('[data-command="gist.open"]')!;
const change = () => row().querySelector('button')!;
const recorder = () => screen.queryByRole('textbox', { name: 'keybindings.recordLabel' });

function startRecording(): HTMLElement {
  fireEvent.click(change());
  const input = recorder();
  expect(input).toBeTruthy();
  return input!;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.app = {
    rev: 1,
    locale: 'en',
    platform: 'linux',
    dev: false,
    settings: defaultSettings,
  };
});

describe('Keybindings recorder', () => {
  it('records a chord and moves focus back to the row', () => {
    render(<KeybindingsSection />);
    const input = startRecording();
    fireEvent.keyDown(input, { key: 'g', code: 'KeyG', ctrlKey: true, altKey: true });

    expect(mocks.settingsApi.SetSetting).toHaveBeenCalledWith('keybindings', {
      'gist.open': 'CmdOrCtrl+Alt+G',
    });
    expect(recorder()).toBeNull();
    expect(document.activeElement).toBe(change());
  });

  it('records a function key without a modifier', () => {
    render(<KeybindingsSection />);
    fireEvent.keyDown(startRecording(), { key: 'F7', code: 'F7' });
    expect(mocks.settingsApi.SetSetting).toHaveBeenCalledWith('keybindings', {
      'gist.open': 'F7',
    });
  });

  it.each([
    ['a letter', { key: 'a', code: 'KeyA' }],
    ['a shifted letter', { key: 'A', code: 'KeyA', shiftKey: true }],
    ['Space', { key: ' ', code: 'Space' }],
    ['Enter', { key: 'Enter', code: 'Enter' }],
    ['an arrow', { key: 'ArrowUp', code: 'ArrowUp' }],
    ['Shift+Escape', { key: 'Escape', code: 'Escape', shiftKey: true }],
  ])(
    'keeps listening instead of recording %s, which every text field needs',
    (_name, init) => {
      render(<KeybindingsSection />);
      const input = startRecording();
      fireEvent.keyDown(input, init);
      expect(mocks.settingsApi.SetSetting).not.toHaveBeenCalled();
      expect(recorder()).toBe(input);
    },
  );

  it('leaves Tab and Shift+Tab to move focus', () => {
    render(<KeybindingsSection />);
    const input = startRecording();
    // fireEvent returns false when the handler called preventDefault.
    expect(fireEvent.keyDown(input, { key: 'Tab', code: 'Tab' })).toBe(true);
    expect(fireEvent.keyDown(input, { key: 'Tab', code: 'Tab', shiftKey: true })).toBe(
      true,
    );
    expect(mocks.settingsApi.SetSetting).not.toHaveBeenCalled();
  });

  it('cancels on Escape and returns focus to the row', () => {
    render(<KeybindingsSection />);
    fireEvent.keyDown(startRecording(), { key: 'Escape', code: 'Escape' });
    expect(mocks.settingsApi.SetSetting).not.toHaveBeenCalled();
    expect(recorder()).toBeNull();
    expect(document.activeElement).toBe(change());
  });

  it('does not take focus back when the recorder was left by moving focus', () => {
    render(<KeybindingsSection />);
    const input = startRecording();
    const other = screen.getByRole('textbox', { name: 'keybindings.filter' });
    fireEvent.blur(input);
    other.focus();
    expect(recorder()).toBeNull();
    expect(document.activeElement).toBe(other);
  });
});
