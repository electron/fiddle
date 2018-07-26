import { EditorsMock } from './editors';

export class ElectronFiddleMock {
  public app = {
    setValues: jest.fn()
  };

  public editors = new EditorsMock();
}
