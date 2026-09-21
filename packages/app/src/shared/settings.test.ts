import { describe, expect, it } from 'vitest';

import {
  acceleratorFromKey,
  changedExecutionSettings,
  defaultSettings,
  effectiveAccelerator,
  effectiveAccelerators,
  findConflicts,
  fromSparse,
  isHttpsUrl,
  isModified,
  isSafeTokenValue,
  localePreference,
  matchKeybinding,
  monacoThemeSchema,
  parseSetting,
  resolveKeybindings,
  resolveScreenReader,
  sameValue,
  settingsSchema,
  toSparse,
  type KeyInput,
} from './settings';
import { normalizeAccelerator } from './accelerators';
import type { KeyContext } from './commands';

describe('execution settings', () => {
  it('accepts only https mirrors', () => {
    expect(isHttpsUrl('https://example.com/electron/')).toBe(true);
    expect(isHttpsUrl('http://example.com/electron/')).toBe(false);
    expect(isHttpsUrl('not a url')).toBe(false);
    expect(
      parseSetting('customMirrorElectron', 'http://example.com/electron/'),
    ).toBeUndefined();
    expect(parseSetting('customMirrorNightly', 'http://127.0.0.1:8080/')).toBeUndefined();
    expect(
      parseSetting('customMirrorNightly', 'https://example.com/nightly/'),
    ).toBeDefined();
  });

  it('lists the flags, variables, mirrors and module install settings a settings import changes', () => {
    const next = {
      ...defaultSettings,
      electronFlags: ['--inspect'],
      environmentVariables: ['A=1'],
      customMirrorElectron: 'https://m/',
      packageManager: 'yarn' as const,
      socketFirewall: false,
      editorFontSize: 20,
    };
    expect(changedExecutionSettings(defaultSettings, next)).toEqual([
      'electronFlags',
      'environmentVariables',
      'customMirrorElectron',
      'packageManager',
      'socketFirewall',
    ]);
    expect(
      changedExecutionSettings(defaultSettings, {
        ...defaultSettings,
        electronFlags: [],
      }),
    ).toEqual([]);
  });
});

describe('schema and defaults', () => {
  it('has a default for every setting', () => {
    expect(settingsSchema.parse({})).toEqual(defaultSettings);
    expect(defaultSettings).toMatchObject({
      appearance: 'system',
      theme: 'lucent',
      locale: 'system',
      sessionRestore: true,
      channels: ['stable', 'beta'],
      showNotDownloaded: true,
      showObsolete: false,
      packageManager: 'npm',
      socketFirewall: true,
      gistPublishAsRevision: true,
      gistShowHistory: true,
      gistVisibility: 'secret',
      screenReader: 'auto',
      mirror: 'auto',
      keybindings: {},
    });
  });

  it('validates values per key', () => {
    expect(parseSetting('packageManager', 'yarn')).toEqual({ value: 'yarn' });
    expect(parseSetting('packageManager', 'pnpm')).toBeUndefined();
    expect(parseSetting('environmentVariables', ['FOO=1', 'BAR='])).toBeDefined();
    expect(parseSetting('environmentVariables', ['not a pair'])).toBeUndefined();
    expect(
      parseSetting('customMirrorElectron', 'https://example.com/electron/'),
    ).toBeDefined();
    expect(parseSetting('customMirrorElectron', 'ftp://example.com/')).toBeUndefined();
    expect(parseSetting('customMirrorElectron', '')).toBeDefined();
    expect(parseSetting('editorFontSize', 14)).toEqual({ value: 14 });
    expect(parseSetting('editorFontSize', 400)).toBeUndefined();
    expect(parseSetting('editorFontFamily', 'x; background: url(evil)')).toBeUndefined();
    expect(
      parseSetting('keybindings', { 'file.save': null, 'file.open': 'Ctrl+P' }),
    ).toBeDefined();
    expect(parseSetting('locale', 'pt-BR')).toBeDefined();
    expect(parseSetting('locale', '../../etc')).toBeUndefined();
  });

  it('stores only values that differ from the defaults', () => {
    const settings = {
      ...defaultSettings,
      packageManager: 'yarn' as const,
      keybindings: { a: null },
    };
    expect(toSparse(settings)).toEqual({
      packageManager: 'yarn',
      keybindings: { a: null },
    });
    expect(fromSparse(toSparse(settings))).toEqual(settings);
    expect(toSparse(defaultSettings)).toEqual({});
  });

  it('marks modified values structurally', () => {
    expect(
      isModified({ ...defaultSettings, channels: ['stable', 'beta'] }, 'channels'),
    ).toBe(false);
    expect(isModified({ ...defaultSettings, channels: ['stable'] }, 'channels')).toBe(
      true,
    );
    expect(sameValue({ a: 1, b: [1, { c: 2 }] }, { a: 1, b: [1, { c: 2 }] })).toBe(true);
    expect(sameValue([1, 2], { 0: 1, 1: 2 })).toBe(false);
  });
});

describe('resolvers', () => {
  it('resolves the screen reader mode and locale preference', () => {
    expect(resolveScreenReader('auto', true)).toBe(true);
    expect(resolveScreenReader('auto', false)).toBe(false);
    expect(resolveScreenReader('on', false)).toBe(true);
    expect(resolveScreenReader('off', true)).toBe(false);
    expect(localePreference('system', ['de-DE'])).toEqual(['de-DE']);
    expect(localePreference('fr', ['de-DE'])).toEqual(['fr', 'de-DE']);
  });
});

describe('keybindings', () => {
  it('applies overrides, and null unbinds', () => {
    expect(effectiveAccelerator('file.save', 'linux', {})).toBe('CmdOrCtrl+S');
    expect(
      effectiveAccelerator('file.save', 'linux', { 'file.save': 'Ctrl+Alt+S' }),
    ).toBe('Ctrl+Alt+S');
    expect(
      effectiveAccelerator('file.save', 'linux', { 'file.save': null }),
    ).toBeUndefined();
  });

  it('normalizes accelerators per platform', () => {
    expect(normalizeAccelerator('CmdOrCtrl+Shift+p', 'win32')).toBe('Ctrl+Shift+P');
    expect(normalizeAccelerator('Shift+Ctrl+P', 'linux')).toBe(
      normalizeAccelerator('CmdOrCtrl+Shift+P', 'linux'),
    );
    expect(normalizeAccelerator('CommandOrControl+P', 'darwin')).toBe('Cmd+P');
    expect(normalizeAccelerator('Option+Command+I', 'darwin')).toBe('Alt+Cmd+I');
    expect(normalizeAccelerator('CmdOrCtrl++', 'linux')).toBe('Ctrl++');
    // Super is Cmd on a Mac; Escape and Return are Esc and Enter everywhere.
    expect(normalizeAccelerator('Meta+Escape', 'linux')).toBe('Super+esc');
    expect(normalizeAccelerator('Super+Escape', 'darwin')).toBe(
      normalizeAccelerator('Cmd+Esc', 'darwin'),
    );
    expect(normalizeAccelerator('AltGr+Return', 'win32')).toBe(
      normalizeAccelerator('altgr+enter', 'win32'),
    );
  });

  it('finds commands that share an accelerator', () => {
    const ids = ['app.newWindow', 'file.newFiddle', 'file.save'] as const;
    expect(findConflicts('linux', {}, ids).size).toBe(0);
    const conflicts = findConflicts('linux', { 'app.newWindow': 'Ctrl+N' }, ids);
    expect([...conflicts]).toEqual([['Ctrl+N', ['app.newWindow', 'file.newFiddle']]]);
    // Unbinding resolves it.
    expect(
      findConflicts('linux', { 'app.newWindow': 'Ctrl+N', 'file.newFiddle': null }, ids)
        .size,
    ).toBe(0);
  });

  it('has no conflicts between the defaults', () => {
    for (const platform of ['darwin', 'win32', 'linux'] as const)
      expect(findConflicts(platform, {}).size).toBe(0);
  });

  it('counts second defaults such as F5 in conflicts', () => {
    expect(effectiveAccelerators('run.toggle', 'linux', {})).toEqual([
      'CmdOrCtrl+R',
      'F5',
    ]);
    expect(effectiveAccelerator('run.toggle', 'linux', {})).toBe('CmdOrCtrl+R');
    expect([...findConflicts('linux', { 'file.save': 'F5' })]).toEqual([
      ['f5', ['file.save', 'run.toggle']],
    ]);
    // An override replaces every default, so F5 goes with it.
    expect(
      effectiveAccelerators('run.toggle', 'linux', { 'run.toggle': 'Ctrl+Enter' }),
    ).toEqual(['Ctrl+Enter']);
    expect(
      findConflicts('linux', { 'file.save': 'F5', 'run.toggle': 'CmdOrCtrl+R' }).size,
    ).toBe(0);
    // F1 opens the palette, in the editor too, where Monaco used it for its own.
    expect(findConflicts('linux', { 'help.showTour': 'F1' }).get('f1')).toEqual([
      'app.commandPalette',
      'help.showTour',
    ]);
  });

  it('only counts conflicts where both bindings can apply', () => {
    // Clear console's CmdOrCtrl+K only applies in the console.
    expect(findConflicts('linux', { 'run.toggle@editor': 'CmdOrCtrl+K' }).size).toBe(0);
    expect([...findConflicts('linux', { 'file.save': 'CmdOrCtrl+K' })]).toEqual([
      ['Ctrl+K', ['file.save', 'console.clear']],
    ]);
    // A fiddle runs whatever has focus.
    expect(findConflicts('linux', { 'run.toggle@running': 'CmdOrCtrl+K' }).size).toBe(1);
  });

  it('resolves overrides scoped to a context', () => {
    const bindings = resolveKeybindings(
      'linux',
      {
        'run.toggle@editor': 'Ctrl+Enter',
        'run.toggle@nowhere': 'Ctrl+J',
        'unknown.command@editor': 'Ctrl+J',
        'console.clear@editor': null,
      },
      ['run.toggle', 'console.clear'],
    );
    expect(bindings).toEqual([
      { id: 'run.toggle', accelerator: 'CmdOrCtrl+R' },
      { id: 'run.toggle', accelerator: 'F5' },
      { id: 'console.clear', accelerator: 'CmdOrCtrl+K', context: 'console' },
      { id: 'run.toggle', accelerator: 'Ctrl+Enter', context: 'editor' },
    ]);
  });

  it('matches a key press, preferring a scoped binding', () => {
    const bindings = resolveKeybindings('linux', {
      'console.clear@editor': 'Ctrl+Shift+K',
      'file.save': 'Ctrl+Shift+K',
    });
    const match = (accelerator: string, ...active: KeyContext[]) =>
      matchKeybinding(bindings, accelerator, new Set(active), 'linux')?.id;
    expect(match('F5')).toBe('run.toggle');
    expect(match('CmdOrCtrl+K')).toBeUndefined();
    expect(match('CmdOrCtrl+K', 'console')).toBe('console.clear');
    expect(match('CmdOrCtrl+Shift+K')).toBe('file.save');
    expect(match('CmdOrCtrl+Shift+K', 'editor')).toBe('console.clear');
    expect(normalizeAccelerator('Escape', 'linux')).toBe(
      normalizeAccelerator('Esc', 'linux'),
    );
  });

  const press = (key: string, mods: Partial<KeyInput> = {}, code?: string): KeyInput => ({
    key,
    code,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...mods,
  });

  it('records key presses as accelerators', () => {
    expect(
      acceleratorFromKey(press('P', { ctrlKey: true, shiftKey: true }, 'KeyP'), 'linux'),
    ).toBe('CmdOrCtrl+Shift+P');
    expect(acceleratorFromKey(press('p', { metaKey: true }, 'KeyP'), 'darwin')).toBe(
      'CmdOrCtrl+P',
    );
    expect(acceleratorFromKey(press('p', { ctrlKey: true }, 'KeyP'), 'darwin')).toBe(
      'Ctrl+P',
    );
    expect(acceleratorFromKey(press('π', { altKey: true }, 'KeyP'), 'darwin')).toBe(
      'Alt+P',
    );
    expect(acceleratorFromKey(press('F5'), 'win32')).toBe('F5');
    expect(acceleratorFromKey(press(',', { ctrlKey: true }), 'linux')).toBe(
      'CmdOrCtrl+,',
    );
    expect(acceleratorFromKey(press('+', { ctrlKey: true }), 'linux')).toBe(
      'CmdOrCtrl+Plus',
    );
    expect(
      acceleratorFromKey(press('Shift', { shiftKey: true }), 'linux'),
    ).toBeUndefined();
    expect(acceleratorFromKey(press('Unidentified'), 'linux')).toBeUndefined();
  });

  // The key names the character typed on the user's layout, not the physical position.
  it.each([
    ['AZERTY undo', press('z', { ctrlKey: true }, 'KeyW'), 'CmdOrCtrl+Z'],
    ['AZERTY digit row', press('&', { ctrlKey: true }, 'Digit1'), 'CmdOrCtrl+1'],
    ['Dvorak open', press('o', { ctrlKey: true }, 'KeyS'), 'CmdOrCtrl+O'],
    ['Dvorak comma', press(',', { ctrlKey: true }, 'KeyW'), 'CmdOrCtrl+,'],
    [
      'Dvorak shifted',
      press('P', { ctrlKey: true, shiftKey: true }, 'KeyL'),
      'CmdOrCtrl+Shift+P',
    ],
    ['QWERTZ', press('y', { ctrlKey: true }, 'KeyZ'), 'CmdOrCtrl+Y'],
    ['Cyrillic copy', press('с', { ctrlKey: true }, 'KeyC'), 'CmdOrCtrl+C'],
    ['Greek', press('ς', { ctrlKey: true }, 'KeyW'), 'CmdOrCtrl+W'],
    [
      'shifted digit',
      press('!', { ctrlKey: true, shiftKey: true }, 'Digit1'),
      'CmdOrCtrl+Shift+1',
    ],
  ])(
    'reads %s from the key, with the physical key as fallback',
    (_name, input, expected) => {
      expect(acceleratorFromKey(input, 'linux')).toBe(expected);
    },
  );

  it('leaves AltGr characters alone', () => {
    const altGr = {
      ctrlKey: true,
      altKey: true,
      getModifierState: (key: string) => key === 'AltGraph',
    };
    expect(acceleratorFromKey(press('@', altGr, 'KeyQ'), 'win32')).toBeUndefined();
    // Ctrl+Alt without AltGr is a shortcut.
    expect(
      acceleratorFromKey(press('q', { ctrlKey: true, altKey: true }, 'KeyQ'), 'win32'),
    ).toBe('CmdOrCtrl+Alt+Q');
  });
});

describe('theme validation', () => {
  it('accepts colours and fonts and rejects anything else', () => {
    expect(isSafeTokenValue('accent', '#9feaf9')).toBe(true);
    expect(isSafeTokenValue('accent', 'rgb(1 2 3 / 50%)')).toBe(true);
    expect(isSafeTokenValue('accent', 'transparent')).toBe(true);
    expect(isSafeTokenValue('font-sans', 'Inter, "Commit Mono", monospace')).toBe(true);
    expect(isSafeTokenValue('accent', 'url(https://evil)')).toBe(false);
    expect(isSafeTokenValue('surface', 'red; background: blue')).toBe(false);
    expect(isSafeTokenValue('font-sans', 'x url(y)')).toBe(false);
    expect(isSafeTokenValue('accent', 'expression(alert(1))')).toBe(false);
  });

  it('needs base or rules in a Monaco theme', () => {
    expect(monacoThemeSchema.safeParse({ base: 'vs-dark' }).success).toBe(true);
    expect(monacoThemeSchema.safeParse({ rules: [] }).success).toBe(true);
    expect(monacoThemeSchema.safeParse({ colors: {} }).success).toBe(false);
    expect(
      monacoThemeSchema.safeParse({
        base: 'vs',
        colors: { 'editor.background': 'url(x)' },
      }).success,
    ).toBe(false);
  });
});
