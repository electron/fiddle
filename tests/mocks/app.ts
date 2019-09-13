import { FileManager } from './file-manager';
import { RemoteLoader } from './remote-loader';
import { RunnerMock } from './runner';

export class AppMock {
  public setupUnsavedOnChangeListener = jest.fn();
  public replaceFiddle = jest.fn();
  public setEditorValues = jest.fn();
  public getEditorValues = jest.fn(() => ({
    main: 'main-content',
    renderer: 'renderer-content',
    html: 'html-content'
  }));

  public setupTheme = jest.fn();

  public typeDefDisposable = {
    dispose: jest.fn()
  };

  public fileManager = new FileManager();
  public runner = new RunnerMock();
  public remoteLoader = new RemoteLoader();

  public monaco = {
    editor: {
      setTheme: jest.fn(),
      defineTheme: jest.fn()
    },
    languages: {
      typescript: {
        javascriptDefaults: {
          addExtraLib: jest.fn()
        }
      }
    }
  };
}
