export class RemoteLoaderMock {
  public confirmAddFile = jest.fn();
  public fetchGistAndLoad = jest.fn();
  public loadFiddleFromElectronExample = jest.fn();
  public loadFiddleFromGist = jest.fn();
  public setElectronVersion = jest.fn();
}
