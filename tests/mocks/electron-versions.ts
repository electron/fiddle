import {
  RunnableVersion,
  VersionSource,
  VersionState,
} from '../../src/interfaces';
import { arrayToStringMap } from '../../src/utils/array-to-stringmap';

export const mockVersionsArray = [
  {
    state: VersionState.ready,
    version: '2.0.2',
    source: VersionSource.remote,
  },
  {
    state: VersionState.ready,
    version: '2.0.1',
    source: VersionSource.remote,
  },
  {
    state: VersionState.ready,
    version: '1.8.7',
    source: VersionSource.remote,
  },
];

export const mockVersions: Record<string, RunnableVersion> = arrayToStringMap(
  mockVersionsArray,
);
