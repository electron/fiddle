import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../ipc/renderer', () => ({ windowApi: { RunCommand: vi.fn(), ReportContextMenu: vi.fn() } }));
vi.mock('../../state', () => ({ useAppState: () => undefined, useWindowState: () => null }));

import { defaultSettings, type Keybindings } from '../../../shared/settings';
import type { AppState, WindowState } from '../../../shared/stores';
import { commandForKey, focusContextOf } from './keybindings';

const appState = (keybindings: Keybindings = {}) =>
  ({ platform: 'linux', settings: { ...defaultSettings, keybindings } }) as unknown as AppState;
const windowState = (status = 'ready') => ({ fiddle: { source: {} }, run: { status } }) as unknown as WindowState;

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
}

function press(key: string, { ctrl = false, shift = false, in: target = 'other' }: Press = {}) {
  const code = /^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : undefined;
  return { key, code, ctrlKey: ctrl, shiftKey: shift, metaKey: false, altKey: false, isComposing: false, target: element(target) };
}

const run = (event: ReturnType<typeof press>, keybindings: Keybindings = {}, win = windowState()) =>
  commandForKey(event as unknown as KeyboardEvent, appState(keybindings), win);

describe('keybinding dispatcher', () => {
  // @feature keys.run
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

  // @feature keys.clear-console
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
    expect(commandForKey(press('F5') as unknown as KeyboardEvent, appState(), undefined)).toBeUndefined();
  });

  it('knows where an element is', () => {
    expect(focusContextOf(element('editor'))).toBe('editor');
    expect(focusContextOf(element('console'))).toBe('console');
    expect(focusContextOf(element('other'))).toBe('other');
    expect(focusContextOf(null)).toBe('other');
  });
});
