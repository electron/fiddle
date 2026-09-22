/** Tests the editor state outside Monaco: the focused editor's actions, the cursor readout and failed renames. */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  RenameFile: vi.fn((_from: string, _to: string) => Promise.resolve(1)),
}));

vi.mock('../../ipc/renderer', () => ({ documentsApi: { RenameFile: mocks.RenameFile } }));

import {
  clearFocusedEditor,
  formatFocusedEditor,
  getEditorActions,
  getViewState,
  releaseViewState,
  renameFile,
  saveViewState,
  setCursor,
  setFocusedEditor,
  useEditorCursor,
} from './editor-state';
import type { monaco } from './monaco';

/** Enough of a Monaco editor for the focused-editor bookkeeping. */
function fakeEditor(actions: Record<string, () => unknown>) {
  const editor = {
    getSupportedActions: () =>
      Object.entries(actions).map(([id, run]) => ({ id, label: `Label of ${id}`, run })),
    getAction: (id: string) => (actions[id] ? { run: actions[id] } : null),
  };
  return editor as unknown as monaco.editor.IStandaloneCodeEditor;
}

beforeEach(() => vi.clearAllMocks());

describe('the focused editor', () => {
  it('lends its actions to the command palette until it is disposed', async () => {
    const format = vi.fn();
    const first = fakeEditor({ 'editor.action.formatDocument': format, fold: vi.fn() });
    const second = fakeEditor({});
    setFocusedEditor(first);
    expect(getEditorActions().map((action) => action.id)).toEqual([
      'editor.action.formatDocument',
      'fold',
    ]);
    getEditorActions()[0]!.run();
    expect(format).toHaveBeenCalledTimes(1);

    await formatFocusedEditor();
    expect(format).toHaveBeenCalledTimes(2);

    // Another pane's editor going away leaves the focused one alone.
    clearFocusedEditor(second);
    expect(getEditorActions()).toHaveLength(2);
    clearFocusedEditor(first);
    expect(getEditorActions()).toEqual([]);
    await expect(formatFocusedEditor()).resolves.toBeUndefined();
  });
});

describe('setCursor', () => {
  it('publishes a new position only when it moved', () => {
    const view = renderHook(() => useEditorCursor());
    setCursor('main.js', 3, 7);
    view.rerender();
    const first = view.result.current;
    expect(first).toEqual({ file: 'main.js', line: 3, column: 7 });
    setCursor('main.js', 3, 7);
    view.rerender();
    expect(view.result.current).toBe(first);
    setCursor('main.js', 4, 1);
    view.rerender();
    expect(view.result.current).toEqual({ file: 'main.js', line: 4, column: 1 });
  });
});

describe('renameFile', () => {
  it('keeps the view state with the old name when main refuses the rename', async () => {
    const state = { scrollTop: 40 } as unknown as monaco.editor.ICodeEditorViewState;
    saveViewState('old.js', state);
    mocks.RenameFile.mockRejectedValueOnce(new Error('name taken'));
    await expect(renameFile('old.js', 'new.js')).rejects.toThrow('name taken');
    // The model is later released under its old name: nothing moves to the name that was refused.
    releaseViewState('old.js');
    expect(getViewState('new.js')).toBeUndefined();
    expect(getViewState('old.js')).toBeUndefined();
  });
});
