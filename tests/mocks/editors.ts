// import { MAIN_JS } from '../../src/interfaces';

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

/*
export class EditorsMock {
  public [MAIN_JS] = new EditorMock(MAIN_JS);
  public [DefaultEditorId.renderer] = new EditorMock(DefaultEditorId.renderer);
  public [DefaultEditorId.html] = new EditorMock(DefaultEditorId.html);
  public [DefaultEditorId.preload] = new EditorMock(DefaultEditorId.preload);
}
*/
