import { ElectronVersion, ElectronVersionSource, ElectronVersionState } from '../../src/interfaces';
import { arrayToStringMap } from '../../src/utils/array-to-stringmap';

export const mockVersionsArray = [
  {
    state: ElectronVersionState.ready,
    version: '2.0.2',
    source: ElectronVersionSource.remote
  }, {
    state: ElectronVersionState.ready,
    version: '2.0.1',
    source: ElectronVersionSource.remote
  }, {
    state: ElectronVersionState.ready,
    version: '1.8.7',
    source: ElectronVersionSource.remote
  }
];

export const mockVersions: Record<string, ElectronVersion> = arrayToStringMap(mockVersionsArray);
