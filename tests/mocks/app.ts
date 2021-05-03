import { DefaultEditorId } from '../../src/interfaces';
import {
  FileManagerMock,
  MonacoEditorMock,
  RemoteLoaderMock,
  RunnerMock,
  StateMock,
} from './mocks';

export class AppMock {
  public setup = jest.fn();
  public replaceFiddle = jest.fn();
  public getEditorValues = jest.fn().mockResolvedValue({
    [DefaultEditorId.main]: 'main-content',
    [DefaultEditorId.preload]: 'preload-content',
    [DefaultEditorId.renderer]: 'renderer-content',
    [DefaultEditorId.html]: 'html-content',
    [DefaultEditorId.css]: 'css-content',
  });

  public loadTheme = jest.fn();
  public openFiddle = jest.fn();

  public typeDefDisposable = {
    dispose: jest.fn(),
  };

  public fileManager = new FileManagerMock();
  public remoteLoader = new RemoteLoaderMock();
  public runner = new RunnerMock();
  public state = new StateMock();
  public taskRunner = {};

  public monaco: any = {
    latestEditor: null,
    latestModel: null,
    editor: {
      create: jest
        .fn()
        .mockImplementation(
          () => (this.monaco.latestEditor = new MonacoEditorMock()),
        ),
      createModel: jest
        .fn()
        .mockImplementation(
          () => (this.monaco.latestModel = { updateOptions: jest.fn() }),
        ),
      onDidFocusEditorText: jest.fn(),
      setTheme: jest.fn(),
      defineTheme: jest.fn(),
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
