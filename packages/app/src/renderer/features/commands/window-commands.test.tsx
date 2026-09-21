/** Tests the renderer's handlers for forwarded window commands: Edit menu roles, editor actions, tab-focus mode, Format all and Clear console. */
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeEditor {
  updateOptions: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
  trigger: ReturnType<typeof vi.fn>;
  setPosition: ReturnType<typeof vi.fn>;
  getSelections: () => Array<{ containsPosition: (position: unknown) => boolean }>;
  /** What Monaco would emit: the listeners the command module registered on this editor. */
  emit: {
    focus?: () => void;
    dispose?: () => void;
    contextMenu?: (event: unknown) => void;
  };
  onDidFocusEditorWidget: (listener: () => void) => void;
  onDidDispose: (listener: () => void) => void;
  onContextMenu: (listener: (event: unknown) => void) => void;
}

interface FakeModel {
  uri: { authority: string; path: string };
  getLanguageId: () => string;
  getValue: () => string;
  getOptions: () => { tabSize: number; insertSpaces: boolean };
  isDisposed: () => boolean;
  getFullModelRange: () => string;
  pushEditOperations: ReturnType<typeof vi.fn>;
}

const mocks = vi.hoisted(() => ({
  command: undefined as ((id: string) => void) | undefined,
  editors: [] as FakeEditor[],
  models: [] as FakeModel[],
  onCreate: undefined as ((editor: FakeEditor) => void) | undefined,
  formatText: vi.fn((text: string, ..._rest: unknown[]) => Promise.resolve(text)),
  clearOutput: vi.fn(() => Promise.resolve()),
  toastError: vi.fn(),
}));

vi.mock('../../../ipc/renderer', () => ({
  runApi: { ClearOutput: mocks.clearOutput },
  windowApi: {
    onCommand: (handler: (id: string) => void) => {
      mocks.command = handler;
      return () => undefined;
    },
  },
}));
vi.mock('../../toast-error', () => ({ toastError: mocks.toastError }));
vi.mock('../../editor/format', () => ({
  formatText: mocks.formatText,
  PRETTIER_PARSERS: { javascript: 'babel', html: 'html' },
}));
vi.mock('../../editor/monaco', () => ({
  monaco: {
    KeyMod: { CtrlCmd: 1, WinCtrl: 2, Shift: 4 },
    KeyCode: { KeyM: 8 },
    editor: {
      onDidCreateEditor: (listener: (editor: FakeEditor) => void) => {
        mocks.onCreate = listener;
      },
      addKeybindingRules: () => undefined,
      getEditors: () => mocks.editors,
      getModels: () => mocks.models,
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

function fakeEditor(): FakeEditor {
  const emit: FakeEditor['emit'] = {};
  return {
    updateOptions: vi.fn(),
    focus: vi.fn(),
    trigger: vi.fn(),
    setPosition: vi.fn(),
    getSelections: () => [],
    emit,
    onDidFocusEditorWidget: (listener) => (emit.focus = listener),
    onDidDispose: (listener) => (emit.dispose = listener),
    onContextMenu: (listener) => (emit.contextMenu = listener),
  };
}
/** Editors the command module has heard of; it may remember one as the last focused. */
const created: FakeEditor[] = [];
/** An editor Monaco just created, as the command module hears of it. */
function createEditor(): FakeEditor {
  const editor = fakeEditor();
  mocks.onCreate?.(editor);
  created.push(editor);
  return editor;
}

function fakeModel(
  path: string,
  text: string,
  overrides: Partial<FakeModel> = {},
): FakeModel {
  const language = path.endsWith('.html')
    ? 'html'
    : path.endsWith('.js')
      ? 'javascript'
      : 'json';
  return {
    uri: { authority: 'fiddle', path },
    getLanguageId: () => language,
    getValue: () => text,
    getOptions: () => ({ tabSize: 2, insertSpaces: true }),
    isDisposed: () => false,
    getFullModelRange: () => `all of ${path}`,
    pushEditOperations: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  seen.length = 0;
  mocks.editors = [fakeEditor(), fakeEditor()];
  mocks.models = [];
  document.body.innerHTML =
    '<input id="field" /><div class="monaco-editor"><textarea id="monaco"></textarea></div>';
  Object.assign(document, { execCommand: vi.fn(() => true) });
});
afterEach(() => {
  vi.restoreAllMocks();
  // The module keeps tab-focus mode and the last focused editor between tests: put both back.
  if (seen.at(-1)) send('editor.toggleTabFocus');
  for (const editor of created.splice(0)) editor.emit.dispose?.();
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

  it('gives an editor created while tab-focus mode is on that mode too', async () => {
    render(<Probe />);
    const before = createEditor();
    await Promise.resolve();
    send('editor.toggleTabFocus');
    const during = createEditor();
    await Promise.resolve();
    expect(during.updateOptions).toHaveBeenCalledWith({ tabFocusMode: true });
    expect(before.updateOptions).not.toHaveBeenCalled();
  });

  it('does what the native role does for Edit menu commands outside the editor', () => {
    render(<Probe />);
    document.getElementById('field')?.focus();
    send('edit.undo');
    send('edit.selectAll');
    expect(document.execCommand).toHaveBeenNthCalledWith(1, 'undo');
    expect(document.execCommand).toHaveBeenNthCalledWith(2, 'selectAll');
  });

  it('sends Edit menu commands inside the editor, and editor commands anywhere, to the editor that last had focus', () => {
    render(<Probe />);
    const editor = createEditor();
    editor.emit.focus?.();
    document.getElementById('monaco')?.focus();
    send('edit.redo');
    expect(document.execCommand).not.toHaveBeenCalled();
    expect(editor.focus).toHaveBeenCalledOnce();
    expect(editor.trigger).toHaveBeenLastCalledWith('fiddle', 'redo', null);

    document.getElementById('field')?.focus();
    send('editor.goToDefinition');
    expect(editor.trigger).toHaveBeenLastCalledWith(
      'fiddle',
      'editor.action.revealDefinition',
      null,
    );
    // Once that editor is gone there is nowhere to send them.
    editor.emit.dispose?.();
    send('editor.findReferences');
    expect(editor.trigger).toHaveBeenCalledTimes(2);
  });

  it('moves the cursor to a right-click outside the selection before the native menu opens, like Monaco’s own menu', () => {
    render(<Probe />);
    const editor = createEditor();
    const inside = { lineNumber: 2, column: 4 };
    const outside = { lineNumber: 9, column: 1 };
    editor.getSelections = () => [
      { containsPosition: (position) => position === inside },
    ];
    editor.emit.contextMenu?.({ target: { position: inside } });
    editor.emit.contextMenu?.({ target: { position: null } });
    expect(editor.setPosition).not.toHaveBeenCalled();
    editor.emit.contextMenu?.({ target: { position: outside } });
    expect(editor.setPosition).toHaveBeenCalledWith(outside);
  });

  it('clears the console through main, toasting a failure', async () => {
    render(<Probe />);
    send('console.clear');
    expect(mocks.clearOutput).toHaveBeenCalledOnce();
    mocks.clearOutput.mockRejectedValueOnce(new Error('no run'));
    send('console.clear');
    await vi.waitFor(() => expect(mocks.toastError).toHaveBeenCalledOnce());
  });
});

describe('Format all', () => {
  it('formats every fiddle file Prettier knows, each as one edit over the whole file', async () => {
    const main = fakeModel('/main.js', 'let a=1');
    const page = fakeModel('/index.html', '<p>hi');
    const data = fakeModel('/package.json', '{}');
    const foreign = fakeModel('/lib.js', 'x', {
      uri: { authority: 'types', path: '/lib.js' },
    });
    mocks.models = [main, page, data, foreign];
    mocks.formatText.mockImplementation((text: string) =>
      Promise.resolve(`${text} formatted`),
    );
    render(<Probe />);
    send('editor.formatAll');
    await vi.waitFor(() => expect(page.pushEditOperations).toHaveBeenCalled());
    expect(mocks.formatText).toHaveBeenCalledTimes(2);
    expect(mocks.formatText).toHaveBeenCalledWith('let a=1', 'javascript', {
      tabSize: 2,
      insertSpaces: true,
    });
    expect(main.pushEditOperations).toHaveBeenCalledWith(
      [],
      [{ range: 'all of /main.js', text: 'let a=1 formatted' }],
      expect.any(Function),
    );
    expect(data.pushEditOperations).not.toHaveBeenCalled();
    expect(foreign.pushEditOperations).not.toHaveBeenCalled();
  });

  it('leaves alone a file that is already formatted, was edited or closed meanwhile, or does not parse', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let editedText = 'let b=2';
    const tidy = fakeModel('/main.js', 'tidy');
    const edited = fakeModel('/renderer.js', 'let b=2', { getValue: () => editedText });
    const closed = fakeModel('/preload.js', 'let c=3', { isDisposed: () => true });
    const broken = fakeModel('/index.html', '<p');
    const last = fakeModel('/z.js', 'let z=9');
    mocks.models = [tidy, edited, closed, broken, last];
    mocks.formatText.mockImplementation((text: string) => {
      if (text === '<p') return Promise.reject(new SyntaxError('Unexpected end'));
      // The user types while Prettier runs.
      if (text === 'let b=2') editedText = 'let b=22';
      return Promise.resolve(text === 'tidy' ? text : `${text} formatted`);
    });
    render(<Probe />);
    send('editor.formatAll');
    await vi.waitFor(() => expect(last.pushEditOperations).toHaveBeenCalled());
    for (const model of [tidy, edited, closed, broken])
      expect(model.pushEditOperations).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[fiddle] formatting failed',
      '/index.html',
      expect.any(SyntaxError),
    );
  });
});
