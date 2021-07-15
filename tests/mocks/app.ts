import {
  ElectronTypesMock,
  FileManagerMock,
  RemoteLoaderMock,
  RunnerMock,
  StateMock,
  createEditorValues,
} from './mocks';

export class AppMock {
  public setup = jest.fn();
  public replaceFiddle = jest.fn();
  public getEditorValues = jest.fn().mockResolvedValue(createEditorValues());
  public loadTheme = jest.fn();
  public openFiddle = jest.fn();

  public fileManager = new FileManagerMock();
  public remoteLoader = new RemoteLoaderMock();
  public electronTypes = new ElectronTypesMock();
  public runner = new RunnerMock();
  public state = new StateMock();
  public taskRunner = {};
}
