import { vi } from 'vitest';

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
  public getEditorValues = vi.fn().mockResolvedValue(createEditorValues());
  public loadTheme = vi.fn();
  public openFiddle = vi.fn();
  public remoteLoader = new RemoteLoaderMock();
  public replaceFiddle = vi.fn();
  public runner = new RunnerMock();
  public setup = vi.fn();
  public state = new StateMock();
  public taskRunner = {};
}
