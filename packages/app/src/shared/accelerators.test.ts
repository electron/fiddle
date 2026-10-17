import { describe, expect, it } from 'vitest';

import { acceleratorKeys, formatAccelerator, normalizeAccelerator } from './accelerators';

describe('acceleratorKeys', () => {
  it('formats macOS symbols', () => {
    expect(acceleratorKeys('CmdOrCtrl+Shift+P', 'darwin')).toEqual(['⌘', '⇧', 'P']);
    expect(acceleratorKeys('CmdOrCtrl+Alt+I', 'darwin')).toEqual(['⌘', '⌥', 'I']);
    expect(acceleratorKeys('Ctrl+Cmd+Left', 'darwin')).toEqual(['⌃', '⌘', '←']);
  });

  it('formats words elsewhere', () => {
    expect(acceleratorKeys('CmdOrCtrl+Shift+P', 'win32')).toEqual(['Ctrl', 'Shift', 'P']);
    expect(acceleratorKeys('CommandOrControl+X', 'linux')).toEqual(['Ctrl', 'X']);
    expect(acceleratorKeys('F5', 'linux')).toEqual(['F5']);
    expect(acceleratorKeys('Ctrl+Shift+PageUp', 'win32')).toEqual([
      'Ctrl',
      'Shift',
      'PageUp',
    ]);
    expect(acceleratorKeys('Shift+Alt+F', 'linux')).toEqual(['Shift', 'Alt', 'F']);
  });

  it('names the Super key by platform', () => {
    expect(acceleratorKeys('Super+E', 'win32')).toEqual(['Win', 'E']);
    expect(acceleratorKeys('Cmd+E', 'linux')).toEqual(['Super', 'E']);
  });

  it('handles Plus, single characters and missing accelerators', () => {
    expect(acceleratorKeys('CmdOrCtrl++', 'linux')).toEqual(['Ctrl', '+']);
    expect(acceleratorKeys('CmdOrCtrl+Plus', 'win32')).toEqual(['Ctrl', '+']);
    expect(acceleratorKeys('CmdOrCtrl+-', 'win32')).toEqual(['Ctrl', '-']);
    expect(acceleratorKeys('CmdOrCtrl+\\', 'linux')).toEqual(['Ctrl', '\\']);
    expect(acceleratorKeys('CmdOrCtrl+,', 'win32')).toEqual(['Ctrl', ',']);
    expect(acceleratorKeys('cmdorctrl+s', 'win32')).toEqual(['Ctrl', 'S']);
    expect(acceleratorKeys(undefined, 'linux')).toEqual([]);
    expect(acceleratorKeys('', 'linux')).toEqual([]);
  });

  it('treats a segment named like an Object member as a plain key', () => {
    expect(acceleratorKeys('Ctrl+constructor', 'win32')).toEqual(['Ctrl', 'constructor']);
    expect(normalizeAccelerator('Ctrl+constructor', 'linux')).toBe('Ctrl+constructor');
  });
});

describe('formatAccelerator', () => {
  it('joins with + on Windows and Linux, and without on macOS', () => {
    expect(formatAccelerator('CmdOrCtrl+Shift+P', 'win32')).toBe('Ctrl+Shift+P');
    expect(formatAccelerator('CmdOrCtrl+Shift+P', 'linux')).toBe('Ctrl+Shift+P');
    expect(formatAccelerator('CmdOrCtrl+Shift+P', 'darwin')).toBe('⌘⇧P');
    expect(formatAccelerator('Alt+F4', 'win32')).toBe('Alt+F4');
    expect(formatAccelerator('F11', 'linux')).toBe('F11');
    expect(formatAccelerator('CmdOrCtrl++', 'win32')).toBe('Ctrl++');
    expect(formatAccelerator(undefined, 'win32')).toBeUndefined();
  });
});
