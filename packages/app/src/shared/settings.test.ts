import { describe, expect, it } from 'vitest';

import {
  acceleratorFromKey,
  changedExecutionSettings,
  defaultSettings,
  effectiveAccelerator,
  findConflicts,
  fromSparse,
  isHttpsUrl,
  isModified,
  isSafeTokenValue,
  localePreference,
  monacoThemeSchema,
  normalizeAccelerator,
  parseSetting,
  resolveMirror,
  resolveScreenReader,
  sameValue,
  settingsSchema,
  toSparse,
  type KeyInput,
} from './settings';

describe('execution settings', () => {
  it('accepts only https mirrors', () => {
    expect(isHttpsUrl('https://example.com/electron/')).toBe(true);
    expect(isHttpsUrl('http://example.com/electron/')).toBe(false);
    expect(isHttpsUrl('not a url')).toBe(false);
    expect(parseSetting('customMirrorElectron', 'http://example.com/electron/')).toBeUndefined();
    expect(parseSetting('customMirrorNightly', 'http://127.0.0.1:8080/')).toBeUndefined();
    expect(parseSetting('customMirrorNightly', 'https://example.com/nightly/')).toBeDefined();
  });

  it('lists the flags, variables and mirrors a settings import changes', () => {
    const next = {
      ...defaultSettings,
      electronFlags: ['--inspect'],
      environmentVariables: ['A=1'],
      customMirrorElectron: 'https://m/',
      packageManager: 'yarn' as const,
    };
    expect(changedExecutionSettings(defaultSettings, next)).toEqual([
      'electronFlags',
      'environmentVariables',
      'customMirrorElectron',
    ]);
    expect(changedExecutionSettings(defaultSettings, { ...defaultSettings, electronFlags: [] })).toEqual([]);
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
    expect(parseSetting('customMirrorElectron', 'https://example.com/electron/')).toBeDefined();
    expect(parseSetting('customMirrorElectron', 'ftp://example.com/')).toBeUndefined();
    expect(parseSetting('customMirrorElectron', '')).toBeDefined();
    expect(parseSetting('editorFontSize', 14)).toEqual({ value: 14 });
    expect(parseSetting('editorFontSize', 400)).toBeUndefined();
    expect(parseSetting('editorFontFamily', 'x; background: url(evil)')).toBeUndefined();
    expect(parseSetting('keybindings', { 'file.save': null, 'file.open': 'Ctrl+P' })).toBeDefined();
    expect(parseSetting('locale', 'pt-BR')).toBeDefined();
    expect(parseSetting('locale', '../../etc')).toBeUndefined();
  });

  it('stores only values that differ from the defaults', () => {
    const settings = { ...defaultSettings, packageManager: 'yarn' as const, keybindings: { a: null } };
    expect(toSparse(settings)).toEqual({ packageManager: 'yarn', keybindings: { a: null } });
    expect(fromSparse(toSparse(settings))).toEqual(settings);
    expect(toSparse(defaultSettings)).toEqual({});
  });

  it('marks modified values structurally', () => {
    expect(isModified({ ...defaultSettings, channels: ['stable', 'beta'] }, 'channels')).toBe(false);
    expect(isModified({ ...defaultSettings, channels: ['stable'] }, 'channels')).toBe(true);
    expect(sameValue({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
    expect(sameValue([1, 2], { 0: 1, 1: 2 })).toBe(false);
  });
});

describe('resolvers', () => {
  it('picks the mirror', () => {
    const base = { mirror: 'auto' as const, customMirrorElectron: '', customMirrorNightly: '' };
    expect(resolveMirror(base, ['zh-CN']).electron).toContain('npmmirror');
    expect(resolveMirror(base, ['zh']).electron).toContain('npmmirror');
    expect(resolveMirror(base, ['en-US']).electron).toContain('github.com');
    expect(
      resolveMirror({ ...base, mirror: 'custom', customMirrorElectron: 'https://m/' }, []),
    ).toEqual({ electron: 'https://m/', nightly: 'https://github.com/electron/nightlies/releases/download/' });
  });

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
    expect(effectiveAccelerator('file.save', 'linux', { 'file.save': 'Ctrl+Alt+S' })).toBe('Ctrl+Alt+S');
    expect(effectiveAccelerator('file.save', 'linux', { 'file.save': null })).toBeUndefined();
  });

  it('normalizes accelerators per platform', () => {
    expect(normalizeAccelerator('CmdOrCtrl+Shift+p', 'win32')).toBe('Ctrl+Shift+P');
    expect(normalizeAccelerator('Shift+Ctrl+P', 'linux')).toBe(normalizeAccelerator('CmdOrCtrl+Shift+P', 'linux'));
    expect(normalizeAccelerator('CommandOrControl+P', 'darwin')).toBe('Cmd+P');
    expect(normalizeAccelerator('Option+Command+I', 'darwin')).toBe('Alt+Cmd+I');
    expect(normalizeAccelerator('CmdOrCtrl++', 'linux')).toBe('Ctrl++');
  });

  it('finds commands that share an accelerator', () => {
    const ids = ['app.newWindow', 'file.newFiddle', 'file.save'] as const;
    expect(findConflicts('linux', {}, ids).size).toBe(0);
    const conflicts = findConflicts('linux', { 'app.newWindow': 'Ctrl+N' }, ids);
    expect([...conflicts]).toEqual([['Ctrl+N', ['app.newWindow', 'file.newFiddle']]]);
    // Unbinding resolves it.
    expect(findConflicts('linux', { 'app.newWindow': 'Ctrl+N', 'file.newFiddle': null }, ids).size).toBe(0);
  });

  it('records key presses as accelerators', () => {
    const press = (key: string, mods: Partial<KeyInput> = {}, code?: string): KeyInput => ({
      key,
      code,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      ...mods,
    });
    expect(acceleratorFromKey(press('P', { ctrlKey: true, shiftKey: true }, 'KeyP'), 'linux')).toBe(
      'CmdOrCtrl+Shift+P',
    );
    expect(acceleratorFromKey(press('p', { metaKey: true }, 'KeyP'), 'darwin')).toBe('CmdOrCtrl+P');
    expect(acceleratorFromKey(press('p', { ctrlKey: true }, 'KeyP'), 'darwin')).toBe('Ctrl+P');
    expect(acceleratorFromKey(press('π', { altKey: true }, 'KeyP'), 'darwin')).toBe('Alt+P');
    expect(acceleratorFromKey(press('F5'), 'win32')).toBe('F5');
    expect(acceleratorFromKey(press(',', { ctrlKey: true }), 'linux')).toBe('CmdOrCtrl+,');
    expect(acceleratorFromKey(press('+', { ctrlKey: true }), 'linux')).toBe('CmdOrCtrl+Plus');
    expect(acceleratorFromKey(press('Shift', { shiftKey: true }), 'linux')).toBeUndefined();
    expect(acceleratorFromKey(press('Unidentified'), 'linux')).toBeUndefined();
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
    expect(monacoThemeSchema.safeParse({ base: 'vs', colors: { 'editor.background': 'url(x)' } }).success).toBe(
      false,
    );
  });
});
