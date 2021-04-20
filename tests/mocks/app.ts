import { EditorMosaicMock } from './editor-mosaic';
import { FileManager } from './file-manager';
import { MockState } from './state';
import { MonacoEditorMock } from './monaco-editor';
import { RemoteLoader } from './remote-loader';
import { RunnerMock } from './runner';
import { createEditorValues } from './editor-values';

export class AppMock {
  public setup = jest.fn();
  public replaceFiddle = jest.fn();
  public setEditorValues = jest.fn();
  public getEditorValues = jest.fn().mockImplementation(() => {
    return Promise.resolve(createEditorValues());
  });
  public loadTheme = jest.fn();
  public openFiddle = jest.fn();

  public typeDefDisposable = {
    dispose: jest.fn(),
  };

  public editorMosaic = new EditorMosaicMock();
  public fileManager = new FileManager();
  public remoteLoader = new RemoteLoader();
  public runner = new RunnerMock();
  public state = new MockState();
  public taskRunner = {};

  public monaco: any = {
    model: {
      updateOptions: jest.fn(),
    },
    editor: {
      lastCreated: null,
      create: jest
        .fn()
        .mockImplementation(
          () => (this.monaco.lastCreated = new MonacoEditorMock()),
        ),
      createModel: () => this.monaco.model,
      defineTheme: jest.fn(),
      onDidFocusEditorText: jest.fn(),
      setTheme: jest.fn(),
    },
    languages: {
      typescript: {
        javascriptDefaults: {
          addExtraLib: jest.fn(),
        },
      },
    },
  };
}
