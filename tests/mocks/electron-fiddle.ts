import { AppMock } from './app';

export class ElectronFiddleMock {
  public app = new AppMock();
  public appPaths = {
    userData: '/fake/path',
    home: `~`,
  };
}
