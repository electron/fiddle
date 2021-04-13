import { FileManager } from './file-manager';
import { MockState } from './state';
import { RemoteLoader } from './remote-loader';
import { RunnerMock } from './runner';
import { DefaultEditorId } from '../../src/interfaces';

export class AppMock {
  public setup = jest.fn();
  public replaceFiddle = jest.fn();
  public setEditorValues = jest.fn();
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
