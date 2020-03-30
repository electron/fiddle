import * as semver from 'semver';

import { RunnableVersion } from '../interfaces';

/**
 * Sorts Electron versions and returns the result of a
 * map function.
 *
 * @param {Record<string, RunnableVersion>} versions
 * @param {(key: string, version: RunnableVersion) => void} mapFn
 * @returns {Array<T>}
 */
export function sortedElectronMap<T>(
  versions: Record<string, RunnableVersion>,
  mapFn: (key: string, version: RunnableVersion) => T
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
