import { AppMock, MonacoMock } from './mocks';

export class ElectronFiddleMock {
  public app = new AppMock();
  public appPaths = {
    userData: '/fake/path',
    home: `~`,
  };
  public monaco = new MonacoMock();
}
