import * as semver from 'semver';

import { ElectronVersion } from '../interfaces';

/**
 * Sorts Electron versions and returns the result of a
 * map function.
 *
 * @param {Record<string, ElectronVersion>} versions
 * @param {(key: string, version: ElectronVersion) => void} mapFn
 * @returns {Array<T>}
 */
export function sortedElectronMap<T>(
  versions: Record<string, ElectronVersion>,
  mapFn: (key: string, version: ElectronVersion) => T
) {
  return Object.keys(versions)
    .sort((a, b) => {
      if (!semver.valid(a) && !semver.valid(b)) {
        return a.localeCompare(b);
      }

      if (!semver.valid(a)) {
        return -1;
      }

      if (!semver.valid(b)) {
        return 1;
      }

      return semver.gt(a, b, true) ? -1 : 1;
    })
    .map((key) => mapFn(key, versions[key])) as Array<T>;
}
