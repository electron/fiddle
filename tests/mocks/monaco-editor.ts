export class MonacoEditorMock {
  private action = {
    isSupported: jest.fn(),
    run: jest.fn(),
  };
  private model = {
    getFullModelRange: jest.fn(),
  };
  public value = '';

  public getAction = jest.fn().mockImplementation(() => this.action);
  public getModel = jest.fn().mockImplementation(() => this.model);
  public getValue = jest.fn().mockImplementation(() => this.value);
  public hasTextFocus = jest.fn();
  public layout = jest.fn();
  public onDidChangeModelContent = jest.fn().mockImplementation((listener) => {
    this.listener = listener;
    return {
      dispose: jest.fn(),
    };
  });
  public restoreViewState = jest.fn();
  public saveViewState = jest.fn();
  public setModel = jest.fn().mockImplementation((model) => {
    console.log('model', !!model, new Error('trace'));
    this.model = model;
  });
  public setSelection = jest.fn();
  public setValue = jest.fn().mockImplementation((value) => {
    this.value = value;
    if (this.listener) this.listener();
  });
  public updateOptions = jest.fn();

  private listener: any;
}
