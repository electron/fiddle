export class AppMock {
  public setValues = jest.fn();
  public getValues = jest.fn(() => ({
    main: 'main-content',
    renderer: 'renderer-content',
    html: 'html-content'
  }));

  public typeDefDisposable = {
    dispose: jest.fn()
  };

  public fileManager = {
    saveToTemp: jest.fn(() => '/mock/temp/dir')
  };

  public monaco = {
    editor: {
      setTheme: jest.fn(),
      defineTheme: jest.fn()
    },
    languages: {
      typescript: {
        javascriptDefaults: {
          addExtraLib: jest.fn()
        }
      }
    }
  };
}
