export class FileManagerMock {
  public getFiles = jest.fn();
  public openFiddle = jest.fn();
  public saveFiddle = jest.fn();
  public saveToTemp = jest.fn().mockResolvedValue('/mock/temp/dir');
}
