import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  command: undefined as ((id: string) => void) | undefined,
  editors: [] as Array<{ updateOptions: ReturnType<typeof vi.fn> }>,
}));

vi.mock('../../../ipc/renderer', () => ({
  runApi: { ClearOutput: vi.fn(() => Promise.resolve()) },
  windowApi: {
    onCommand: (handler: (id: string) => void) => {
      mocks.command = handler;
      return () => undefined;
    },
  },
}));
vi.mock('../../editor/format', () => ({ formatText: vi.fn(), PRETTIER_PARSERS: {} }));
vi.mock('../../editor/monaco', () => ({
  monaco: {
    KeyMod: { CtrlCmd: 1, WinCtrl: 2, Shift: 4 },
    KeyCode: { KeyM: 8 },
    editor: {
      onDidCreateEditor: () => undefined,
      addKeybindingRules: () => undefined,
      getEditors: () => mocks.editors,
      getModels: () => [],
    },
  },
}));

import { useTabFocusMode, useWindowCommands } from './window-commands';

const seen: boolean[] = [];
function Probe() {
  useWindowCommands();
  seen.push(useTabFocusMode());
  return null;
}
const send = (id: string) => act(() => mocks.command?.(id));

beforeEach(() => {
  vi.clearAllMocks();
  seen.length = 0;
  mocks.editors = [{ updateOptions: vi.fn() }, { updateOptions: vi.fn() }];
  document.body.innerHTML = '<input id="field" />';
  Object.assign(document, { execCommand: vi.fn(() => true) });
});

describe('window commands', () => {
  it('turns tab-focus mode on and off in every editor', () => {
    render(<Probe />);
    send('editor.toggleTabFocus');
    expect(seen.at(-1)).toBe(true);
    for (const editor of mocks.editors)
      expect(editor.updateOptions).toHaveBeenLastCalledWith({ tabFocusMode: true });
    send('editor.toggleTabFocus');
    expect(seen.at(-1)).toBe(false);
    for (const editor of mocks.editors)
      expect(editor.updateOptions).toHaveBeenLastCalledWith({ tabFocusMode: false });
  });

  it('does what the native role does for Edit menu commands outside the editor', () => {
    render(<Probe />);
    document.getElementById('field')?.focus();
    send('edit.undo');
    send('edit.selectAll');
    expect(document.execCommand).toHaveBeenNthCalledWith(1, 'undo');
    expect(document.execCommand).toHaveBeenNthCalledWith(2, 'selectAll');
  });
});
