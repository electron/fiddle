export class FileManager {
  public cleanup = jest.fn();
  public openFiddle = jest.fn();
  public saveToTemp = jest.fn(() => '/mock/temp/dir');
}
