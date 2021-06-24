import { MonacoEditorMock } from './mocks';

export class MonacoMock {
  public latestEditor: MonacoEditorMock;
  public latestModel: any;
  public editor = {
    create: jest
      .fn()
      .mockImplementation(() => (this.latestEditor = new MonacoEditorMock())),
    createModel: jest
      .fn()
      .mockImplementation(
        () => (this.latestModel = { updateOptions: jest.fn() }),
      ),
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
