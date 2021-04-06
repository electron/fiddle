import {
  RunnableVersion,
  VersionSource,
  VersionState,
} from '../../src/interfaces';

// prefer using this, since making new instances prevents state
// from bleeding between tests.
export class MockVersions {
  public readonly array: RunnableVersion[];
  public readonly mockVersions: Record<string, RunnableVersion>;
  public readonly mockVersionsArray: RunnableVersion[];
  public readonly object: Record<string, RunnableVersion>;

  constructor() {
    const versions = ['2.0.3', '2.0.2', '2.0.1', '2.0.0', '1.8.7'];

    this.array = versions.map((version) => ({
      source: VersionSource.remote,
      state: VersionState.ready,
      version,
    }));

    this.object = {};
    for (const ver of this.array) {
      this.object[ver.version] = ver;
    }

    this.mockVersions = this.object;
    this.mockVersionsArray = this.array;
  }
}

// export static instances for the tests that still use them
export const { mockVersions, mockVersionsArray } = new MockVersions();
