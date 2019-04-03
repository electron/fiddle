export class FileManager {
  public saveToTemp = jest.fn(() => '/mock/temp/dir');
  public setFiddle = jest.fn();
  public cleanup = jest.fn();
}
