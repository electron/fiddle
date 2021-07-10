import {
  ElectronTypesMock,
  FileManagerMock,
  RemoteLoaderMock,
  RunnerMock,
  StateMock,
  createEditorValues,
} from './mocks';

export class AppMock {
  public electronTypes = new ElectronTypesMock();
  public fileManager = new FileManagerMock();
  public getEditorValues = jest.fn().mockResolvedValue(createEditorValues());
  public loadTheme = jest.fn();
  public openFiddle = jest.fn();
  public remoteLoader = new RemoteLoaderMock();
  public replaceFiddle = jest.fn();
  public runner = new RunnerMock();
  public setup = jest.fn();
  public state = new StateMock();
  public taskRunner = {};
}
