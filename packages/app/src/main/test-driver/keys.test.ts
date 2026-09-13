import { describe, expect, it } from 'vitest';

import { parseKeyCombo } from './keys';

describe('parseKeyCombo', () => {
  it('maps CmdOrCtrl per platform and types nothing for shortcuts', () => {
    expect(parseKeyCombo('CmdOrCtrl+S', 'darwin')).toEqual({ keyCode: 'S', modifiers: ['meta'], text: undefined });
    expect(parseKeyCombo('CmdOrCtrl+Shift+P', 'linux')).toEqual({
      keyCode: 'P',
      modifiers: ['control', 'shift'],
      text: undefined,
    });
  });

  it('types text for Enter, Space and single characters', () => {
    expect(parseKeyCombo('Enter', 'linux').text).toBe('\r');
    expect(parseKeyCombo('Space', 'linux').text).toBe(' ');
    expect(parseKeyCombo('Shift+a', 'linux').text).toBe('A');
    expect(parseKeyCombo('Tab', 'linux').text).toBeUndefined();
  });

  it('accepts DOM key names and the plus key', () => {
    expect(parseKeyCombo('ArrowDown', 'win32').keyCode).toBe('Down');
    expect(parseKeyCombo('Escape', 'win32').keyCode).toBe('Escape');
    expect(parseKeyCombo('+', 'linux').keyCode).toBe('+');
  });

  it('rejects unknown modifiers', () => {
    expect(() => parseKeyCombo('Hyper+K', 'linux')).toThrow(/Unknown modifier/);
  });
});
