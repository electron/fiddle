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
  mapFn: (key: string, version: RunnableVersion) => T,
) {
  return Object.keys(versions)
    .sort((a, b) => {
      if (!semver.valid(a) && !semver.valid(b)) {
        return a.localeCompare(b);
      }

      if (!semver.valid(a)) return -1;
      if (!semver.valid(b)) return 1;

      // Handle prerelease tag sorting - semver does not handle this.
      // See https://www.npmjs.com/package/semver#prerelease-tags for more.
      const bothPre = semver.prerelease(a) && semver.prerelease(b);
      const sameCoerced =
        semver.valid(semver.coerce(a)) === semver.valid(semver.coerce(b));
      if (bothPre && sameCoerced) {
        const [tagA, valueA] = semver.prerelease(a)!;
        const [tagB, valueB] = semver.prerelease(b)!;

        if (tagA === 'beta' && tagA === tagB) {
          // Both are betas - compare beta number.
          return valueA > valueB ? -1 : 1;
        } else if (tagA === 'nightly' && tagA === tagB) {
          // Both are nightlies - compare nightly dates strings.
          return -`${valueA}`.localeCompare(`${valueB}`);
        } else {
          // beta > nightly for the same major version.
          return tagA === 'beta' ? -1 : 1;
        }
      }

      return semver.gt(a, b, true) ? -1 : 1;
    })
    .map((key) => mapFn(key, versions[key])) as Array<T>;
}
