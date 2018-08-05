export class FileManager {
  public saveToTemp = jest.fn(() => '/mock/temp/dir');
  public cleanup = jest.fn();
}
