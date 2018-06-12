import * as semver from 'semver';

import { ElectronVersion, StringMap } from '../interfaces';

/**
 * Sorts Electron versions and returns the result of a
 * map function.
 *
 * @param {StringMap<ElectronVersion>} versions
 * @param {(key: string, version: ElectronVersion) => void} mapFn
 * @returns {Array<T>}
 */
export function sortedElectronMap<T>(
  versions: StringMap<ElectronVersion>,
  mapFn: (key: string, version: ElectronVersion) => T
) {
  return Object.keys(versions)
    .sort((a, b) => semver.gt(a, b, true) ? -1 : 1)
    .map((key) => mapFn(key, versions[key])) as Array<T>;
}
