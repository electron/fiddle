export class MonacoEditorMock {
  public getModel = jest.fn();
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
  public setModel = jest.fn();
  public setValue = jest.fn().mockImplementation((value) => {
    this.value = value;
    if (this.listener) this.listener();
  });
  public updateOptions = jest.fn();

  public value = '';
  private listener: any;
}
