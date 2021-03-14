import { AppMock } from './app';
import { EditorsMock } from './editors';
import * as electron from './electron';

export class ElectronFiddleMock {
  public app = new AppMock();
  public editors = new EditorsMock();
  public appPaths = {
    userData: (electron as any).remote.app.getPath('userData'),
    home: `~`,
  };
}
