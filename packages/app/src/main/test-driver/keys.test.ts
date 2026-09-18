import { describe, expect, it } from 'vitest';

import { keyForCharacter, MODIFIER_BIT, parseKeyCombo } from './keys';

const { alt, control, meta, shift } = MODIFIER_BIT;

describe('parseKeyCombo', () => {
  it('maps CmdOrCtrl per platform and types nothing for shortcuts', () => {
    expect(parseKeyCombo('CmdOrCtrl+S', 'darwin')).toEqual({
      key: 's',
      code: 'KeyS',
      keyCode: 83,
      modifiers: meta,
      text: undefined,
      commands: [],
    });
    expect(parseKeyCombo('CmdOrCtrl+Shift+P', 'linux')).toEqual({
      key: 'P',
      code: 'KeyP',
      keyCode: 80,
      modifiers: control | shift,
      text: undefined,
      commands: [],
    });
    expect(parseKeyCombo('Ctrl+Shift+PageUp', 'darwin')).toMatchObject({
      key: 'PageUp',
      keyCode: 33,
      modifiers: control | shift,
    });
    expect(parseKeyCombo('Alt+Cmd+I', 'darwin').modifiers).toBe(alt | meta);
    // Alt alone is a key of its own (the menu bar's); before another key it's a modifier.
    expect(parseKeyCombo('Alt', 'linux')).toMatchObject({
      key: 'Alt',
      code: 'AltLeft',
      keyCode: 18,
      modifiers: 0,
      text: undefined,
    });
    expect(parseKeyCombo('Alt+f', 'win32')).toMatchObject({
      key: 'f',
      code: 'KeyF',
      modifiers: alt,
      text: undefined,
    });
  });

  it('knows the punctuation keys shortcuts use', () => {
    expect(parseKeyCombo('CmdOrCtrl+,', 'darwin')).toMatchObject({
      key: ',',
      code: 'Comma',
      keyCode: 188,
      text: undefined,
    });
    expect(parseKeyCombo('CmdOrCtrl+\\', 'linux')).toMatchObject({
      key: '\\',
      code: 'Backslash',
      keyCode: 220,
    });
    expect(parseKeyCombo('CmdOrCtrl+/', 'linux')).toMatchObject({
      code: 'Slash',
      keyCode: 191,
    });
    expect(parseKeyCombo('CmdOrCtrl+0', 'linux')).toMatchObject({
      key: '0',
      code: 'Digit0',
      keyCode: 48,
    });
  });

  it('types text for Enter, Space and characters, shifted as written or as held', () => {
    expect(parseKeyCombo('Enter', 'linux')).toMatchObject({
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      text: '\r',
    });
    expect(parseKeyCombo('Space', 'linux')).toMatchObject({
      key: ' ',
      code: 'Space',
      keyCode: 32,
      text: ' ',
    });
    expect(parseKeyCombo('a', 'linux')).toMatchObject({
      key: 'a',
      keyCode: 65,
      modifiers: 0,
      text: 'a',
    });
    expect(parseKeyCombo('Shift+a', 'linux')).toMatchObject({
      key: 'A',
      keyCode: 65,
      modifiers: shift,
      text: 'A',
    });
    expect(parseKeyCombo('A', 'linux')).toMatchObject({
      key: 'A',
      modifiers: 0,
      text: 'A',
    });
    expect(parseKeyCombo('?', 'linux')).toMatchObject({
      key: '?',
      code: 'Slash',
      text: '?',
    });
    expect(parseKeyCombo('Shift+/', 'linux')).toMatchObject({
      key: '?',
      code: 'Slash',
      text: '?',
    });
  });

  it('types nothing for keys that only act', () => {
    for (const key of [
      'Tab',
      'Escape',
      'Backspace',
      'Delete',
      'ArrowLeft',
      'Home',
      'F5',
      'ContextMenu',
    ]) {
      expect(parseKeyCombo(key, 'linux').text, key).toBeUndefined();
    }
    expect(parseKeyCombo('Delete', 'win32')).toMatchObject({
      key: 'Delete',
      code: 'Delete',
      keyCode: 46,
    });
    expect(parseKeyCombo('Backspace', 'win32').keyCode).toBe(8);
    expect(parseKeyCombo('Shift+Tab', 'win32')).toMatchObject({
      key: 'Tab',
      keyCode: 9,
      modifiers: shift,
    });
    expect(parseKeyCombo('F5', 'linux')).toMatchObject({
      key: 'F5',
      code: 'F5',
      keyCode: 116,
    });
    expect(parseKeyCombo('F12', 'linux').keyCode).toBe(123);
  });

  it('accepts DOM and Electron key names in any case, and the plus key', () => {
    expect(parseKeyCombo('ArrowDown', 'win32')).toMatchObject({
      key: 'ArrowDown',
      keyCode: 40,
    });
    expect(parseKeyCombo('down', 'win32')).toMatchObject({
      key: 'ArrowDown',
      keyCode: 40,
    });
    expect(parseKeyCombo('Esc', 'win32')).toMatchObject({ key: 'Escape', keyCode: 27 });
    expect(parseKeyCombo('return', 'win32')).toMatchObject({ key: 'Enter', text: '\r' });
    expect(parseKeyCombo('+', 'linux')).toMatchObject({
      key: '+',
      code: 'Equal',
      keyCode: 187,
      text: '+',
    });
    expect(parseKeyCombo('Plus', 'linux')).toMatchObject({
      key: '+',
      code: 'Equal',
      text: '+',
    });
    expect(parseKeyCombo('CmdOrCtrl++', 'linux')).toMatchObject({
      key: '+',
      code: 'Equal',
      modifiers: control,
      text: undefined,
    });
  });

  it('attaches the Edit menu commands to Cmd shortcuts on macOS only', () => {
    expect(parseKeyCombo('CmdOrCtrl+C', 'darwin').commands).toEqual(['Copy']);
    expect(parseKeyCombo('CmdOrCtrl+A', 'darwin').commands).toEqual(['SelectAll']);
    expect(parseKeyCombo('CmdOrCtrl+Z', 'darwin').commands).toEqual(['Undo']);
    expect(parseKeyCombo('Shift+CmdOrCtrl+Z', 'darwin').commands).toEqual(['Redo']);
    expect(parseKeyCombo('CmdOrCtrl+Shift+V', 'darwin').commands).toEqual([
      'PasteAndMatchStyle',
    ]);
    expect(parseKeyCombo('CmdOrCtrl+Shift+C', 'darwin').commands).toEqual([]);
    expect(parseKeyCombo('Ctrl+C', 'darwin').commands).toEqual([]);
    expect(parseKeyCombo('CmdOrCtrl+C', 'linux').commands).toEqual([]);
    expect(parseKeyCombo('CmdOrCtrl+S', 'darwin').commands).toEqual([]);
  });

  it('presses the Menu key for Shift+F10 on macOS', () => {
    expect(parseKeyCombo('Shift+F10', 'darwin')).toMatchObject({
      key: 'ContextMenu',
      keyCode: 93,
      modifiers: 0,
      text: undefined,
    });
    expect(parseKeyCombo('Shift+F10', 'linux')).toMatchObject({
      key: 'F10',
      keyCode: 121,
      modifiers: shift,
    });
    expect(parseKeyCombo('CmdOrCtrl+Shift+F10', 'darwin')).toMatchObject({
      key: 'F10',
      modifiers: meta | shift,
    });
  });

  it('rejects unknown modifiers and keys', () => {
    expect(() => parseKeyCombo('Hyper+K', 'linux')).toThrow(/Unknown modifier/);
    expect(() => parseKeyCombo('CmdOrCtrl+Nope', 'linux')).toThrow(/Unknown key "Nope"/);
    expect(() => parseKeyCombo('', 'linux')).toThrow(/Empty key combo/);
  });
});

describe('keyForCharacter', () => {
  it('finds the key of every printable US-layout character', () => {
    expect(keyForCharacter('a')).toMatchObject({ key: 'a', code: 'KeyA', keyCode: 65 });
    expect(keyForCharacter('A')).toMatchObject({
      code: 'KeyA',
      keyCode: 65,
      shiftText: 'A',
    });
    expect(keyForCharacter('7')).toMatchObject({ code: 'Digit7', keyCode: 55 });
    expect(keyForCharacter('&')).toMatchObject({ code: 'Digit7', keyCode: 55 });
    expect(keyForCharacter(' ')).toMatchObject({ code: 'Space', keyCode: 32 });
    expect(keyForCharacter('/')).toMatchObject({ code: 'Slash', keyCode: 191 });
    expect(keyForCharacter('=')).toMatchObject({
      code: 'Equal',
      keyCode: 187,
      shiftText: '+',
    });
    expect(keyForCharacter(';')).toMatchObject({
      code: 'Semicolon',
      keyCode: 186,
      shiftText: ':',
    });
    for (const char of '`~-_[{]}\\|\'".>,<')
      expect(keyForCharacter(char), char).toBeDefined();
  });

  it('leaves other characters to text insertion', () => {
    expect(keyForCharacter('é')).toBeUndefined();
    expect(keyForCharacter('…')).toBeUndefined();
    expect(keyForCharacter('\n')).toBeUndefined();
  });
});
