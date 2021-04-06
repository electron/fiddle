import {
  RunnableVersion,
  VersionSource,
  VersionState,
} from '../../src/interfaces';

export const mockVersions: Record<string, RunnableVersion> = {
  '2.0.3': {
    source: VersionSource.remote,
    state: VersionState.ready,
    version: '2.0.3',
  },
  '2.0.2': {
    source: VersionSource.remote,
    state: VersionState.ready,
    version: '2.0.2',
  },
  '2.0.1': {
    source: VersionSource.remote,
    state: VersionState.ready,
    version: '2.0.1',
  },
  '2.0.0': {
    source: VersionSource.remote,
    state: VersionState.ready,
    version: '2.0.0',
  },
  '1.8.7': {
    source: VersionSource.remote,
    state: VersionState.ready,
    version: '1.8.7',
  },
};

export const mockVersionsArray = Object.values(mockVersions);
