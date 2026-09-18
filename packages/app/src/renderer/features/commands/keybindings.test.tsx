import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  RunCommand: vi.fn((_id: string) => Promise.resolve()),
  app: undefined as unknown,
  win: null as unknown,
}));

vi.mock('../../../ipc/renderer', () => ({
  windowApi: {
    RunCommand: mocks.RunCommand,
    ReportContextMenu: vi.fn(() => Promise.resolve()),
  },
}));
vi.mock('../../state', () => ({
  useAppState: () => mocks.app,
  useWindowState: () => mocks.win,
}));

import { defaultSettings, type Keybindings } from '../../../shared/settings';
import type { AppState, WindowState } from '../../../shared/stores';
import { commandForKey, focusContextOf, useKeybindings } from './keybindings';

const appState = (keybindings: Keybindings = {}) =>
  ({
    platform: 'linux',
    settings: { ...defaultSettings, keybindings },
  }) as unknown as AppState;
const windowState = (status = 'ready') =>
  ({ fiddle: { source: {} }, run: { status } }) as unknown as WindowState;

document.body.innerHTML = `
  <div class="monaco-editor"><textarea id="editor"></textarea></div>
  <section data-tour="console"><ol id="console" tabindex="0"></ol></section>
  <input id="recorder" data-keybinding-recorder />
  <button id="other"></button>`;
const element = (id: string) => document.getElementById(id);

interface Press {
  ctrl?: boolean;
  shift?: boolean;
  in?: string;
  /** The physical key, where the layout puts the character somewhere other than QWERTY does. */
  code?: string;
}

function press(
  key: string,
  { ctrl = false, shift = false, in: target = 'other', code: physical }: Press = {},
) {
  const code = physical ?? (/^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : undefined);
  return {
    key,
    code,
    ctrlKey: ctrl,
    shiftKey: shift,
    metaKey: false,
    altKey: false,
    isComposing: false,
    target: element(target),
  };
}

const run = (
  event: ReturnType<typeof press>,
  keybindings: Keybindings = {},
  win = windowState(),
) => commandForKey(event as unknown as KeyboardEvent, appState(keybindings), win);

describe('keybinding dispatcher', () => {
  it('runs every default keybinding, the second ones included', () => {
    expect(run(press('F5'))).toBe('run.toggle');
    expect(run(press('r', { ctrl: true }))).toBe('run.toggle');
    expect(run(press('F1', { in: 'editor' }))).toBe('app.commandPalette');
    expect(run(press('x'))).toBeUndefined();
  });

  it('follows overrides: an override replaces the defaults and null unbinds', () => {
    const override = { 'run.toggle': 'Ctrl+Enter' };
    expect(run(press('F5'), override)).toBeUndefined();
    expect(run(press('Enter', { ctrl: true }), override)).toBe('run.toggle');
    expect(run(press('F5'), { 'run.toggle': null })).toBeUndefined();
  });

  it('applies scoped keybindings only in their context', () => {
    // Clear console is CmdOrCtrl+K in the console; elsewhere Monaco keeps its chords.
    expect(run(press('k', { ctrl: true, in: 'console' }))).toBe('console.clear');
    expect(run(press('k', { ctrl: true, in: 'editor' }))).toBeUndefined();
    expect(run(press('F12', { in: 'editor' }))).toBe('editor.goToDefinition');
    expect(run(press('F12'))).toBeUndefined();

    const scoped = { 'run.toggle@editor': 'Ctrl+Enter', 'run.toggle@running': 'Escape' };
    expect(run(press('Enter', { ctrl: true, in: 'editor' }), scoped)).toBe('run.toggle');
    expect(run(press('Enter', { ctrl: true, in: 'console' }), scoped)).toBeUndefined();
    expect(run(press('Escape'), scoped, windowState('running'))).toBe('run.toggle');
    expect(run(press('Escape'), scoped)).toBeUndefined();
  });

  it('leaves native editing keys, the shortcut recorder and disabled commands alone', () => {
    expect(run(press('z', { ctrl: true, in: 'editor' }))).toBeUndefined();
    expect(run(press('a', { ctrl: true }))).toBeUndefined();
    expect(run(press('F5', { in: 'recorder' }))).toBeUndefined();
    // Run needs a window.
    expect(
      commandForKey(press('F5') as unknown as KeyboardEvent, appState(), undefined),
    ).toBeUndefined();
  });

  it('follows the typed character on other layouts, not the key position', () => {
    // AZERTY: Ctrl+Z (undo) sits where QWERTY has W, which is Close window.
    expect(run(press('z', { ctrl: true, code: 'KeyW' }))).toBeUndefined();
    // Dvorak: Ctrl+R (Run) sits where QWERTY has O.
    expect(run(press('r', { ctrl: true, code: 'KeyO' }))).toBe('run.toggle');
    expect(run(press('w', { ctrl: true, code: 'KeyComma' }))).toBe('file.close');
  });

  it('knows where an element is', () => {
    expect(focusContextOf(element('editor'))).toBe('editor');
    expect(focusContextOf(element('console'))).toBe('console');
    expect(focusContextOf(element('other'))).toBe('other');
    expect(focusContextOf(null)).toBe('other');
  });
});

describe('useKeybindings', () => {
  function Probe() {
    useKeybindings();
    return null;
  }
  const keydown = (init: KeyboardEventInit) => {
    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      ...init,
    });
    document.body.dispatchEvent(event);
    return event;
  };

  afterEach(() => {
    mocks.app = undefined;
    mocks.win = null;
    vi.clearAllMocks();
  });

  it('runs the bound command and keeps the key from the page and the native menu', () => {
    mocks.app = appState();
    mocks.win = windowState();
    render(<Probe />);
    const event = keydown({ key: 'r', code: 'KeyR', ctrlKey: true });
    expect(event.defaultPrevented).toBe(true);
    expect(mocks.RunCommand).toHaveBeenCalledWith('run.toggle');
    // Holding the key doesn't start and stop the run again.
    mocks.RunCommand.mockClear();
    expect(
      keydown({ key: 'r', code: 'KeyR', ctrlKey: true, repeat: true }).defaultPrevented,
    ).toBe(true);
    expect(mocks.RunCommand).not.toHaveBeenCalled();
  });

  it('leaves keys no command uses to the page', () => {
    mocks.app = appState();
    mocks.win = windowState();
    render(<Probe />);
    expect(keydown({ key: 'x', code: 'KeyX' }).defaultPrevented).toBe(false);
    expect(mocks.RunCommand).not.toHaveBeenCalled();
  });
});
