import { vi } from 'vitest';

import { objectDifference } from '../utils';

export class MonacoModelMock {
  private options: any;
  constructor(
    private value: string,
    private language: string,
  ) {}

  public getFullModelRange = vi.fn();
  public getValue = vi.fn(() => this.value);
  public setValue = vi.fn((v) => (this.value = v));
  public updateOptions = vi.fn((opts) => (this.options = opts));
  public getModeId = vi.fn(() => this.language);

  public toJSON() {
    const { language, options, value } = this;
    return JSON.stringify({ language, options, value });
  }
}

export class MonacoMock {
  public latestEditor!: MonacoEditorMock;
  public latestModel: any;
  public editor = {
    create: vi.fn(() => (this.latestEditor = new MonacoEditorMock())),
    getModel: vi.fn(),
    createModel: vi.fn((value: string, language: string) => {
      const model = new MonacoModelMock(value, language);
      this.latestModel = model;
      return model;
    }),
    defineTheme: vi.fn(),
    onDidFocusEditorText: vi.fn(),
    revealLine: vi.fn(),
    setTheme: vi.fn(),
    onDidChangeMarkers: vi.fn(),
    getModelMarkers: vi.fn(() => []),
  };
  public languages = {
    register: vi.fn(),
    registerCompletionItemProvider: vi.fn(),
    setMonarchTokensProvider: vi.fn(),
    typescript: {
      javascriptDefaults: {
        addExtraLib: vi.fn(),
      },
    },
  };
  public Uri = {
    parse: vi.fn((uri: string) => ({ toString: () => uri })),
  };
  public MarkerSeverity = {
    Hint: 1,
    Info: 2,
    Warning: 4,
    Error: 8,
  };
  public KeyMod = {
    CtrlCmd: vi.fn(),
  };
  public KeyCode = {
    KEY_K: vi.fn(),
  };
}

export class MonacoEditorMock {
  private action = {
    isSupported: vi.fn(),
    run: vi.fn(),
  };
  private listener: any;
  private model = new MonacoModelMock('', 'javascript');
  private scrollHeight = 0;

  public focus = vi.fn();
  public addCommand = vi.fn();
  public dispose = vi.fn();
  public getAction = vi.fn(() => this.action);
  public getModel = vi.fn(() => this.model);
  public getScrollHeight = vi.fn(() => this.scrollHeight);
  public getValue = vi.fn(() => this.getModel().getValue());
  public hasTextFocus = vi.fn();
  public layout = vi.fn();
  public onDidChangeModelContent = vi.fn((listener) => {
    this.listener = listener;
    return { dispose: vi.fn() };
  });
  public onDidFocusEditorText = vi.fn();
  public register = vi.fn();
  public registerCompletionItemProvider = vi.fn();
  public restoreViewState = vi.fn();
  public revealLine = vi.fn();
  public saveViewState = vi.fn();
  public setModel = vi.fn((model) => (this.model = model));
  public setMonarchTokensProvider = vi.fn();
  public setSelection = vi.fn();
  public setValue = vi.fn((value) => {
    this.getModel().setValue(value);
    if (this.listener) this.listener();
  });
  public updateOptions = vi.fn((opts) => this.getModel().updateOptions(opts));

  public toJSON() {
    const o = objectDifference(this, new MonacoEditorMock());
    return Object.keys(o).length === 0 ? 'default MonacoEditorMock' : o;
  }
}
