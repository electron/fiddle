export class EditorMock {
  public layout = jest.fn();
  public hasTextFocus = jest.fn();
  public getModel = jest.fn().mockReturnValue({ testModel: true });
  public restoreViewState = jest.fn();
  public saveViewState = jest.fn().mockReturnValue({ testViewState: true });
  public setValue = jest.fn();
  public getValue = jest.fn().mockReturnValue('editor-value');
  public onDidChangeModelContent = jest.fn().mockReturnValue({
    dispose: jest.fn(),
  });
  public updateOptions = jest.fn();

  constructor(public readonly name: string) {}
}

export class EditorsMock {
  public 'main.js' = new EditorMock('main.js');
  public 'renderer.js' = new EditorMock('renderer.js');
  public 'index.html' = new EditorMock('index.html');
  public 'preload.js' = new EditorMock('preload.js');
}
