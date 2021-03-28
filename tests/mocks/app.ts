import { FileManager } from './file-manager';
import { MockState } from './state';
import { RemoteLoader } from './remote-loader';
import { RunnerMock } from './runner';

export class AppMock {
  public setup = jest.fn();
  public setupUnsavedOnChangeListener = jest.fn();
  public replaceFiddle = jest.fn();
  public setEditorValues = jest.fn();
  public getEditorValues = jest.fn().mockResolvedValue({
    main: 'main-content',
    preload: 'preload-content',
    renderer: 'renderer-content',
    html: 'html-content',
    css: 'css-content',
  });

  public loadTheme = jest.fn();
  public openFiddle = jest.fn();

  public typeDefDisposable = {
    dispose: jest.fn(),
  };

  public fileManager = new FileManager();
  public remoteLoader = new RemoteLoader();
  public runner = new RunnerMock();
  public state = new MockState();
  public taskRunner = {};

  public monaco = {
    editor: {
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
