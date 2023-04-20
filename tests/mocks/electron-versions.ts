import {
  InstallState,
  RunnableVersion,
  VersionSource,
} from '../../src/interfaces';

export class VersionsMock {
  public readonly mockVersions: Record<string, RunnableVersion>;
  public readonly mockVersionsArray: RunnableVersion[];

  constructor() {
    const versions = ['2.0.3', '2.0.2', '2.0.1', '2.0.0', '1.8.7'];

    const arr = versions.map((version) => ({
      source: VersionSource.remote,
      state: InstallState.installed,
      version,
    }));

    const obj: Record<string, RunnableVersion> = {};
    for (const ver of arr) {
      obj[ver.version] = ver;
    }

    this.mockVersions = obj;
    this.mockVersionsArray = arr;
  }
}
