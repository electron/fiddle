import { vi } from 'vitest';

export class RemoteLoaderMock {
  public confirmAddFile = vi.fn();
  public fetchGistAndLoad = vi.fn();
  public loadFiddleFromElectronExample = vi.fn();
  public loadFiddleFromGist = vi.fn();
  public setElectronVersion = vi.fn();
}
