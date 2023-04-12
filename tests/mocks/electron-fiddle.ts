import { AppMock, MonacoMock } from './mocks';

export class ElectronFiddleMock {
  public app = new AppMock();
  public appPaths = {
    userData: '/fake/path',
    home: `~`,
  };
  public arch = process.arch;
  public getTemplateValues = jest.fn();
  public monaco = new MonacoMock();
  public platform = process.platform;
}
