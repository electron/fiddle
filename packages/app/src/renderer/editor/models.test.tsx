import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

class FakeModel {
  disposed = false;
  private listeners: Array<() => void> = [];
  constructor(
    private value: string,
    readonly uri: { path: string },
  ) {}
  getValue = () => this.value;
  setValue(next: string) {
    this.value = next;
    for (const listener of this.listeners) listener();
  }
  onDidChangeContent(listener: () => void) {
    this.listeners.push(listener);
    return { dispose: () => undefined };
  }
  updateOptions = () => undefined;
  dispose = () => {
    this.disposed = true;
  };
  getLineCount = () => this.value.split('\n').length;
  /** The identifier around the column, on the fake's single-word lines. */
  getWordAtPosition = ({ lineNumber }: { lineNumber: number }) => {
    const word = /\w+/.exec(this.value.split('\n')[lineNumber - 1] ?? '');
    return word
      ? { startColumn: word.index + 1, endColumn: word.index + 1 + word[0].length }
      : null;
  };
  decorations: unknown[] = [];
  deltaDecorations = (_old: string[], next: unknown[]) => {
    this.decorations = next;
    return next.map((_, i) => `d${i}`);
  };
}

interface Marker {
  owner: string;
  severity: number;
}

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  logError: vi.fn(),
  GetFiles: vi.fn(),
  EditFile: vi.fn((_name: string, _text: string, _rev: number) => Promise.resolve(0)),
  RenameFile: vi.fn(() => Promise.resolve(0)),
  markersChanged: undefined as (() => void) | undefined,
  markers: {} as Record<string, Marker[]>,
  setModelMarkers: vi.fn(
    (_model: unknown, _owner: string, _markers: unknown[]) => undefined,
  ),
  setEditorMarkers: vi.fn((_markers: unknown[]) => undefined),
}));

vi.mock('../../ipc/renderer', () => ({ documentsApi: mocks }));
vi.mock('../toast-error', () => ({ toastError: mocks.toastError }));
vi.mock('../features/about/log', () => ({ log: { error: mocks.logError } }));
vi.mock('./diagnostics', () => ({ setEditorMarkers: mocks.setEditorMarkers }));
vi.mock('./monaco', () => ({
  monaco: {
    Uri: { from: ({ path }: { path: string }) => ({ path }) },
    Range: class {
      constructor(
        readonly startLineNumber: number,
        readonly startColumn: number,
        readonly endLineNumber: number,
        readonly endColumn: number,
      ) {}
    },
    MarkerSeverity: { Error: 8, Warning: 4 },
    editor: {
      createModel: (text: string, _language: string, uri: { path: string }) =>
        new FakeModel(text, uri),
      onDidChangeMarkers: (listener: () => void) => {
        mocks.markersChanged = listener;
        return { dispose: () => undefined };
      },
      getModelMarkers: ({ resource }: { resource: { path: string } }) =>
        mocks.markers[resource.path] ?? [],
      setModelMarkers: mocks.setModelMarkers,
    },
  },
}));

type Models = typeof import('./models');

let models: Models;
let editorState: typeof import('./editor-state');
let runtimeErrors: typeof import('./runtime-errors');
/** Lets the pending send go: a first edit after a pause is sent at once, later ones within 250 ms wait. */
const settle = (ms = 250) => vi.advanceTimersByTime(ms);
const files = (texts: Record<string, string>) => Promise.resolve(texts);

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  vi.clearAllMocks();
  mocks.markers = {};
  models = await import('./models');
  editorState = await import('./editor-state');
  runtimeErrors = await import('./runtime-errors');
});

describe('editor models', () => {
  it('sends an edit stamped with the rev the text came from, once for edits made together', async () => {
    mocks.GetFiles.mockReturnValue(files({ 'main.js': 'a' }));
    await models.syncModels(['main.js'], 3);
    const model = models.getModel('main.js')!;
    model.setValue('ab');
    model.setValue('abc');
    settle();
    expect(mocks.EditFile).toHaveBeenCalledTimes(1);
    expect(mocks.EditFile).toHaveBeenCalledWith('main.js', 'abc', 3);
  });

  it('sends at most one edit per interval while typing, and the last text goes at the end of it', async () => {
    mocks.GetFiles.mockReturnValue(files({ 'main.js': '' }));
    await models.syncModels(['main.js'], 1);
    const model = models.getModel('main.js')!;
    model.setValue('a');
    settle(1);
    expect(mocks.EditFile).toHaveBeenCalledTimes(1);
    model.setValue('ab');
    settle(100);
    model.setValue('abc');
    settle(100);
    expect(mocks.EditFile).toHaveBeenCalledTimes(1);
    settle(100);
    expect(mocks.EditFile).toHaveBeenCalledTimes(2);
    expect(mocks.EditFile).toHaveBeenLastCalledWith('main.js', 'abc', 1);
  });

  it('sends what was typed before a shortcut or a focus change can act on it', async () => {
    mocks.GetFiles.mockReturnValue(files({ 'main.js': '' }));
    await models.syncModels(['main.js'], 1);
    const model = models.getModel('main.js')!;
    model.setValue('a');
    settle(1);
    model.setValue('ab');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', metaKey: true }));
    expect(mocks.EditFile).toHaveBeenLastCalledWith('main.js', 'ab', 1);
    model.setValue('abc');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }));
    expect(mocks.EditFile).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new FocusEvent('blur'));
    expect(mocks.EditFile).toHaveBeenLastCalledWith('main.js', 'abc', 1);
  });

  it('does not echo the text main sent back to it', async () => {
    mocks.GetFiles.mockReturnValueOnce(files({ 'main.js': 'a' }));
    await models.syncModels(['main.js'], 1);
    mocks.GetFiles.mockReturnValueOnce(files({ 'main.js': 'new fiddle' }));
    await models.syncModels(['main.js'], 2);
    settle();
    expect(models.getModel('main.js')!.getValue()).toBe('new fiddle');
    expect(mocks.EditFile).not.toHaveBeenCalled();
  });

  // A rename bumps the rev as a new fiddle does, and leaves the text as main has it.
  it('keeps text typed while the new rev is on its way, and sends it with that rev', async () => {
    mocks.GetFiles.mockReturnValueOnce(files({ 'main.js': 'a', 'view.js': '' }));
    await models.syncModels(['main.js', 'view.js'], 1);
    let reply!: (texts: Record<string, string>) => void;
    mocks.GetFiles.mockReturnValueOnce(new Promise((resolve) => (reply = resolve)));
    const sync = models.syncModels(['main.js', 'renamed.js'], 2);
    models.getModel('main.js')!.setValue('ab');
    // Made against the old rev, which main would drop: it waits.
    settle();
    expect(mocks.EditFile).not.toHaveBeenCalled();
    reply({ 'main.js': 'a', 'renamed.js': '' });
    await sync;
    expect(models.getModel('main.js')!.getValue()).toBe('ab');
    settle();
    expect(mocks.EditFile).toHaveBeenCalledWith('main.js', 'ab', 2);
  });

  it("replaces text typed while a new fiddle's text is on its way", async () => {
    mocks.GetFiles.mockReturnValueOnce(files({ 'main.js': 'a' }));
    await models.syncModels(['main.js'], 1);
    let reply!: (texts: Record<string, string>) => void;
    mocks.GetFiles.mockReturnValueOnce(new Promise((resolve) => (reply = resolve)));
    const sync = models.syncModels(['main.js'], 2);
    models.getModel('main.js')!.setValue('ab');
    reply({ 'main.js': 'new fiddle' });
    await sync;
    settle();
    expect(models.getModel('main.js')!.getValue()).toBe('new fiddle');
    expect(mocks.EditFile).not.toHaveBeenCalled();
  });

  it('tells the user once when sending fails, logs each failure and sends the text again later', async () => {
    mocks.GetFiles.mockReturnValue(files({ 'main.js': '' }));
    await models.syncModels(['main.js'], 1);
    const model = models.getModel('main.js')!;
    mocks.EditFile.mockRejectedValue(new Error('gone'));
    model.setValue('a');
    settle(1);
    await vi.advanceTimersByTimeAsync(0);
    model.setValue('ab');
    settle();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.logError).toHaveBeenCalledTimes(2);
    expect(mocks.toastError).toHaveBeenCalledTimes(1);

    mocks.EditFile.mockResolvedValue(0);
    window.dispatchEvent(new FocusEvent('blur'));
    expect(mocks.EditFile).toHaveBeenLastCalledWith('main.js', 'ab', 1);
  });

  it('disposes the models of files that are gone', async () => {
    mocks.GetFiles.mockReturnValueOnce(files({ 'main.js': '', 'old.js': '' }));
    await models.syncModels(['main.js', 'old.js'], 1);
    const old = models.getModel('old.js') as unknown as FakeModel;
    await models.syncModels(['main.js'], 1);
    expect(old.disposed).toBe(true);
    expect(models.getModel('old.js')).toBeUndefined();
  });

  it("carries a renamed file's view state to its new name and drops it for a removed file", async () => {
    const state = (name: string) => ({ name }) as never;
    mocks.GetFiles.mockReturnValueOnce(
      files({ 'main.js': '', 'old.js': '', 'gone.js': '' }),
    );
    await models.syncModels(['main.js', 'old.js', 'gone.js'], 1);
    editorState.saveViewState('old.js', state('old'));
    editorState.saveViewState('gone.js', state('gone'));

    await editorState.renameFile('old.js', 'new.js');
    mocks.GetFiles.mockReturnValueOnce(files({ 'main.js': '', 'new.js': '' }));
    await models.syncModels(['main.js', 'new.js'], 2);

    expect(editorState.getViewState('new.js')).toEqual(state('old'));
    expect(editorState.getViewState('old.js')).toBeUndefined();
    expect(editorState.getViewState('gone.js')).toBeUndefined();
  });
});

describe('useModel', () => {
  it('follows a file as its model comes and goes, and the first sync marks the models ready', async () => {
    const model = renderHook(() => models.useModel('main.js'));
    const ready = renderHook(() => models.useModelsSynced());
    expect(model.result.current).toBeUndefined();
    expect(ready.result.current).toBe(false);

    mocks.GetFiles.mockReturnValue(files({ 'main.js': 'a' }));
    await act(() => models.syncModels(['main.js'], 1));
    act(() => models.markModelsSynced());
    expect(model.result.current?.getValue()).toBe('a');
    expect(ready.result.current).toBe(true);

    await act(() => models.syncModels([], 1));
    expect(model.result.current).toBeUndefined();
  });
});

describe('markers', () => {
  it("reports Monaco's own errors and warnings by file, leaving the runtime markers to the console", async () => {
    mocks.GetFiles.mockReturnValue(files({ 'main.js': '', 'styles.css': '' }));
    await models.syncModels(['main.js', 'styles.css'], 1);
    mocks.markers = {
      '/main.js': [
        { owner: 'typescript', severity: 8 },
        { owner: 'fiddle-runtime', severity: 8 },
        { owner: 'typescript', severity: 2 },
      ],
      '/styles.css': [{ owner: 'css', severity: 4 }],
    };
    mocks.markersChanged?.();
    expect(mocks.setEditorMarkers).toHaveBeenLastCalledWith([
      { file: 'main.js', severity: 'error' },
      { file: 'styles.css', severity: 'warning' },
    ]);
  });

  it('underlines the word where a runtime error was thrown and highlights its line, in the file it names', async () => {
    mocks.GetFiles.mockReturnValue(
      files({ 'main.js': 'first\n  second()\nthird', 'renderer.js': 'x' }),
    );
    await models.syncModels(['main.js', 'renderer.js'], 1);
    const error = (file: string, line: number) => ({
      file,
      line,
      column: 3,
      message: `boom at ${line}`,
      process: 'main' as const,
    });
    // Line 9 is past the end of main.js (an error from an older text): it is left out.
    runtimeErrors.setRuntimeErrors([error('main.js', 2), error('main.js', 9)]);
    models.applyRuntimeErrors(runtimeErrors.getRuntimeErrors());

    const main = models.getModel('main.js') as unknown as FakeModel;
    const [, owner, markers] = mocks.setModelMarkers.mock.calls
      .filter(([model]) => model === main)
      .at(-1)!;
    expect(owner).toBe('fiddle-runtime');
    expect(markers).toEqual([
      expect.objectContaining({
        message: 'boom at 2',
        startLineNumber: 2,
        startColumn: 3,
        endColumn: 9,
      }),
    ]);
    expect(main.decorations).toEqual([
      expect.objectContaining({ range: expect.objectContaining({ startLineNumber: 2 }) }),
    ]);
    const renderer = models.getModel('renderer.js') as unknown as FakeModel;
    expect(renderer.decorations).toEqual([]);
  });
});
