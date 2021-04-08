import { DefaultEditorId } from '../../src/interfaces';

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
  public 'main.js' = new EditorMock(DefaultEditorId.main);
  public 'renderer.js' = new EditorMock(DefaultEditorId.renderer);
  public 'index.html' = new EditorMock(DefaultEditorId.html);
  public 'preload.js' = new EditorMock(DefaultEditorId.preload);
}
