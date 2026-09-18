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
  getWordAtPosition = () => null;
  deltaDecorations = () => [];
}

const mocks = vi.hoisted(() => ({
  GetFiles: vi.fn(),
  EditFile: vi.fn((_name: string, _text: string, _rev: number) => Promise.resolve(0)),
  RenameFile: vi.fn(() => Promise.resolve(0)),
}));

vi.mock('../../ipc/renderer', () => ({ documentsApi: mocks }));
vi.mock('./monaco', () => ({
  monaco: {
    Uri: { from: ({ path }: { path: string }) => ({ path }) },
    Range: class {},
    MarkerSeverity: { Error: 8, Warning: 4 },
    editor: {
      createModel: (text: string, _language: string, uri: { path: string }) =>
        new FakeModel(text, uri),
      onDidChangeMarkers: () => ({ dispose: () => undefined }),
      getModelMarkers: () => [],
      setModelMarkers: () => undefined,
    },
  },
}));

type Models = typeof import('./models');

let models: Models;
let editorState: typeof import('./editor-state');
let frames: Array<() => void> = [];
const nextFrame = () => {
  const run = frames;
  frames = [];
  for (const frame of run) frame();
};
const files = (texts: Record<string, string>) => Promise.resolve(texts);

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (frame: () => void) => frames.push(frame));
  models = await import('./models');
  editorState = await import('./editor-state');
});

describe('editor models', () => {
  it('sends an edit once per frame, stamped with the rev the text came from', async () => {
    mocks.GetFiles.mockReturnValue(files({ 'main.js': 'a' }));
    await models.syncModels(['main.js'], 3);
    const model = models.getModel('main.js')!;
    model.setValue('ab');
    model.setValue('abc');
    nextFrame();
    expect(mocks.EditFile).toHaveBeenCalledTimes(1);
    expect(mocks.EditFile).toHaveBeenCalledWith('main.js', 'abc', 3);
  });

  it('does not echo the text main sent back to it', async () => {
    mocks.GetFiles.mockReturnValueOnce(files({ 'main.js': 'a' }));
    await models.syncModels(['main.js'], 1);
    mocks.GetFiles.mockReturnValueOnce(files({ 'main.js': 'new fiddle' }));
    await models.syncModels(['main.js'], 2);
    nextFrame();
    expect(models.getModel('main.js')!.getValue()).toBe('new fiddle');
    expect(mocks.EditFile).not.toHaveBeenCalled();
  });

  it('keeps an edit typed while new text is on its way from reaching main', async () => {
    mocks.GetFiles.mockReturnValueOnce(files({ 'main.js': 'a', 'view.js': '' }));
    await models.syncModels(['main.js', 'view.js'], 1);
    // A rename bumps the rev; the reply lists the files as main has them.
    let reply!: (texts: Record<string, string>) => void;
    mocks.GetFiles.mockReturnValueOnce(new Promise((resolve) => (reply = resolve)));
    const sync = models.syncModels(['main.js', 'renamed.js'], 2);
    models.getModel('main.js')!.setValue('ab');
    nextFrame();
    // Made against the old text, so it carries the old rev and main drops it.
    expect(mocks.EditFile).toHaveBeenCalledWith('main.js', 'ab', 1);
    reply({ 'main.js': 'a', 'renamed.js': '' });
    await sync;
    expect(models.getModel('main.js')!.getValue()).toBe('a');
    mocks.EditFile.mockClear();
    models.getModel('main.js')!.setValue('ac');
    nextFrame();
    expect(mocks.EditFile).toHaveBeenCalledWith('main.js', 'ac', 2);
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
