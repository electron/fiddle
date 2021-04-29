export class FileManagerMock {
  public cleanup = jest.fn();
  public getFiles = jest.fn();
  public openFiddle = jest.fn();
  public openTemplate = jest.fn();
  public saveFiddle = jest.fn();
  public saveToTemp = jest.fn().mockResolvedValue('/mock/temp/dir');
}
