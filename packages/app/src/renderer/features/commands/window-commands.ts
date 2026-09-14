/**
 * The window's side of commands main forwards (`Window.Command`) that act on
 * Monaco or the console:
 * - undo, redo and select all in the focused editor (anywhere else, what the
 *   native roles do);
 * - go to definition, find references and format selection;
 * - format every file with Prettier (../../editor/format.ts);
 * - tab-focus mode (REQUIREMENTS §10), shown in the status bar;
 * - clear console.
 *
 * It also turns off Monaco's own context menu, since main shows a native one
 * (src/main/context-menu.ts), and Monaco's CmdOrCtrl+M, which is Minimize.
 */
import { useEffect, useSyncExternalStore } from 'react';

import { runApi, windowApi } from '../../../ipc/renderer';
import { formatText, PRETTIER_PARSERS, type FormatLanguage } from '../../editor/format';
import { monaco } from '../../editor/monaco';
import { focusContextOf } from './keybindings';

type Editor = monaco.editor.ICodeEditor;

/** Monaco actions (or `trigger` handler IDs) behind forwarded commands. */
const EDITOR_ACTIONS: Readonly<Record<string, string>> = {
  'edit.undo': 'undo',
  'edit.redo': 'redo',
  'edit.selectAll': 'editor.action.selectAll',
  'editor.goToDefinition': 'editor.action.revealDefinition',
  'editor.findReferences': 'editor.action.referenceSearch.trigger',
  'editor.formatSelection': 'editor.action.formatSelection',
};

/** Outside the editor, the Edit menu does what its native roles would. */
const NATIVE_EDIT: Readonly<Record<string, string>> = {
  'edit.undo': 'undo',
  'edit.redo': 'redo',
  'edit.selectAll': 'selectAll',
};

let lastEditor: Editor | null = null;
let tabFocus = false;
const listeners = new Set<() => void>();

monaco.editor.onDidCreateEditor((editor) => {
  // After the constructor has applied the editor's own options.
  queueMicrotask(() => editor.updateOptions({ contextmenu: false, ...(tabFocus && { tabFocusMode: true }) }));
  editor.onDidFocusEditorWidget(() => {
    lastEditor = editor;
  });
  editor.onDidDispose(() => {
    if (lastEditor === editor) lastEditor = null;
  });
  // Monaco's own menu moves the cursor to a right-click outside the selection; so does the native one.
  editor.onContextMenu(({ target }) => {
    const position = target.position;
    if (position && !editor.getSelections()?.some((selection) => selection.containsPosition(position))) {
      editor.setPosition(position);
    }
  });
});

// `editor.toggleTabFocus` replaces Monaco's binding: CmdOrCtrl+M is Minimize (§17.14).
monaco.editor.addKeybindingRules([
  { keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyM, command: '-editor.action.toggleTabFocusMode' },
  {
    keybinding: monaco.KeyMod.WinCtrl | monaco.KeyMod.Shift | monaco.KeyCode.KeyM,
    command: '-editor.action.toggleTabFocusMode',
  },
]);

function setTabFocus(on: boolean): void {
  tabFocus = on;
  for (const editor of monaco.editor.getEditors()) editor.updateOptions({ tabFocusMode: on });
  for (const listener of listeners) listener();
}

/** True while Tab moves focus out of the editor instead of inserting a tab. */
export function useTabFocusMode(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => tabFocus,
  );
}

/** Formats every fiddle file Prettier can format, each as one undoable edit. */
export async function formatAllFiles(): Promise<void> {
  for (const model of monaco.editor.getModels()) {
    const language = model.getLanguageId();
    if (model.uri.authority !== 'fiddle' || !Object.hasOwn(PRETTIER_PARSERS, language)) continue;
    const text = model.getValue();
    const { tabSize, insertSpaces } = model.getOptions();
    try {
      const formatted = await formatText(text, language as FormatLanguage, { tabSize, insertSpaces });
      if (formatted === text || model.isDisposed() || model.getValue() !== text) continue;
      model.pushEditOperations([], [{ range: model.getFullModelRange(), text: formatted }], () => null);
    } catch (error) {
      // Usually a syntax error: leave that file alone. The editor's markers show where.
      console.warn('[fiddle] formatting failed', model.uri.path, error);
    }
  }
}

function editorAction(id: string, action: string): void {
  const inEditor = focusContextOf(document.activeElement) === 'editor';
  const native = NATIVE_EDIT[id];
  if (native && !inEditor) {
    // What webContents.undo() and friends do: the editing command on the focused element.
    document.execCommand(native);
    return;
  }
  const editor = lastEditor;
  if (!editor) return;
  editor.focus();
  editor.trigger('fiddle', action, null);
}

/** Handles the forwarded commands above for this window. */
export function useWindowCommands(): void {
  useEffect(
    () =>
      windowApi.onCommand((id) => {
        const action = EDITOR_ACTIONS[id];
        if (action !== undefined) editorAction(id, action);
        else if (id === 'editor.formatAll') void formatAllFiles();
        else if (id === 'editor.toggleTabFocus') setTabFocus(!tabFocus);
        else if (id === 'console.clear') {
          runApi.ClearOutput().catch((error: unknown) => console.error('[fiddle] clearing the console failed', error));
        }
      }),
    [],
  );
}
