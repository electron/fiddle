export class EditorMock {
  public layout = jest.fn();
  public isFocused = jest.fn();

  constructor(public readonly name: string) {

  }
}

export class EditorsMock {
  public main = new EditorMock('main');
  public renderer = new EditorMock('renderer');
  public html = new EditorMock('html');
}
