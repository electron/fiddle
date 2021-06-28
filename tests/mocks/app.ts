import { DefaultEditorId } from '../../src/interfaces';
import {
  ElectronTypesMock,
  FileManagerMock,
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

  public fileManager = new FileManagerMock();
  public remoteLoader = new RemoteLoaderMock();
  public electronTypes = new ElectronTypesMock();
  public runner = new RunnerMock();
  public state = new StateMock();
  public taskRunner = {};
}
