import { AppMock, MonacoMock } from './mocks';

export class ElectronFiddleMock {
  public app = new AppMock();
  public appPaths = {
    userData: '/fake/path',
    home: `~`,
  };
  public arch = process.arch;
  public monaco = new MonacoMock();
  public platform = process.platform;
}
