import { EditorsMock } from './editors';

export class ElectronFiddleMock {
  public app = {
    setValues: jest.fn(),
    getValues: jest.fn(() => ({
      main: 'main-content',
      renderer: 'renderer-content',
      html: 'html-content'
    })),
    monaco: {
      editor: {
        defineTheme: jest.fn()
      }
    }
  };

  public editors = new EditorsMock();
}
