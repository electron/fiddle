import { objectDifference } from '../utils';

export class MonacoModelMock {
  private options: any;
  constructor(private value: string, private language: string) {}

  public getFullModelRange = jest.fn();
  public getValue = jest.fn(() => this.value);
  public setValue = jest.fn((v) => (this.value = v));
  public updateOptions = jest.fn((opts) => (this.options = opts));
  public getModeId = jest.fn(() => this.language);

  public toJSON() {
    const { language, options, value } = this;
    return JSON.stringify({ language, options, value });
  }
}

export class MonacoMock {
  public latestEditor: MonacoEditorMock;
  public latestModel: any;
  public editor = {
    create: jest.fn(() => (this.latestEditor = new MonacoEditorMock())),
    createModel: jest.fn((value: string, language: string) => {
      const model = new MonacoModelMock(value, language);
      this.latestModel = model;
      return model;
    }),
    defineTheme: jest.fn(),
    onDidFocusEditorText: jest.fn(),
    revealLine: jest.fn(),
    setTheme: jest.fn(),
  };
  public languages = {
    register: jest.fn(),
    registerCompletionItemProvider: jest.fn(),
    setMonarchTokensProvider: jest.fn(),
    typescript: {
      javascriptDefaults: {
        addExtraLib: jest.fn(),
      },
    },
  };
}

export class MonacoEditorMock {
  private action = {
    isSupported: jest.fn(),
    run: jest.fn(),
  };
  private listener: any;
  private model = new MonacoModelMock('', 'javascript');
  private scrollHeight = 0;

  public dispose = jest.fn();
  public getAction = jest.fn(() => this.action);
  public getModel = jest.fn(() => this.model);
  public getScrollHeight = jest.fn(() => this.scrollHeight);
  public getValue = jest.fn(() => this.getModel().getValue());
  public hasTextFocus = jest.fn();
  public layout = jest.fn();
  public onDidChangeModelContent = jest.fn((listener) => {
    this.listener = listener;
    return { dispose: jest.fn() };
  });
  public onDidFocusEditorText = jest.fn();
  public register = jest.fn();
  public registerCompletionItemProvider = jest.fn();
  public restoreViewState = jest.fn();
  public revealLine = jest.fn();
  public saveViewState = jest.fn();
  public setContent = jest.fn();
  public setModel = jest.fn((model) => (this.model = model));
  public setMonarchTokensProvider = jest.fn();
  public setSelection = jest.fn();
  public setValue = jest.fn((value) => {
    this.getModel().setValue(value);
    if (this.listener) this.listener();
  });
  public updateOptions = jest.fn((opts) => this.getModel().updateOptions(opts));

  public toJSON() {
    const o = objectDifference(this, new MonacoEditorMock());
    return Object.keys(o).length === 0 ? 'default MonacoEditorMock' : o;
  }
}
