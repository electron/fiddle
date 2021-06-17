import { objectDifference } from '../utils';

export class MonacoEditorMock {
  public action = {
    isSupported: jest.fn(),
    run: jest.fn(),
  };
  public model = {
    getFullModelRange: jest.fn(),
  };
  public scrollHeight = 0;
  public value = '';

  public dispose = jest.fn();
  public getAction = jest.fn().mockImplementation(() => this.action);
  public getModel = jest.fn().mockImplementation(() => this.model);
  public getScrollHeight = jest
    .fn()
    .mockImplementation(() => this.scrollHeight);
  public getValue = jest.fn().mockImplementation(() => this.value);
  public hasTextFocus = jest.fn();
  public layout = jest.fn();
  public onDidChangeModelContent = jest.fn().mockImplementation((listener) => {
    this.listener = listener;
    return {
      dispose: jest.fn(),
    };
  });
  public onDidFocusEditorText = jest.fn();
  public register = jest.fn();
  public registerCompletionItemProvider = jest.fn();
  public restoreViewState = jest.fn();
  public revealLine = jest.fn();
  public saveViewState = jest.fn();
  public setContent = jest.fn();
  public setModel = jest.fn().mockImplementation((model) => {
    this.model = model;
  });
  public setMonarchTokensProvider = jest.fn();
  public setSelection = jest.fn();
  public setValue = jest.fn().mockImplementation((value) => {
    this.value = value;
    if (this.listener) this.listener();
  });
  public updateOptions = jest.fn();
  private listener: any;

  public toJSON() {
    const o = objectDifference(this, new MonacoEditorMock());
    return Object.keys(o).length === 0 ? 'default MonacoEditorMock' : o;
  }
}
