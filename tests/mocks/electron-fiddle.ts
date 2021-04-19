import { AppMock } from './app';
// FIXME(ckerr) import { EditorsMock } from './editors';

export class ElectronFiddleMock {
  public app = new AppMock();
  // FIXME(ckerr) public editors = new EditorsMock();
  public appPaths = {
    userData: '/fake/path',
    home: `~`,
  };
}
