export class EditorMock {
  public layout = jest.fn();
}

export class EditorsMock {
  public main = new EditorMock();
  public renderer = new EditorMock();
  public html = new EditorMock();
}
