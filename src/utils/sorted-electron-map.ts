import * as semver from 'semver';

import { RunnableVersion } from '../interfaces';

function electronSemVerCompare(a: semver.SemVer, b: semver.SemVer) {
  const l = a.compareMain(b);
  if (l) return l;
  // Electron's approach is nightly -> beta -> stable.
  // Account for 'beta' coming before 'nightly' lexicographically
  if (a.prerelease[0] === 'nightly' && b.prerelease[0] === 'beta') return -1;
  if (a.prerelease[0] === 'beta' && b.prerelease[0] === 'nightly') return 1;
  return a.comparePre(b);
}

function sortByNew(a: semver.SemVer | string, b: semver.SemVer | string) {
  // non-semver goes first, sorted lexicographically
  const astr = typeof a === 'string';
  const bstr = typeof b === 'string';
  if (astr && bstr) return (a as string).localeCompare(b as string);
  if (astr) return -1;
  if (bstr) return 1;

  // then semver, sorted newest-to-oldest
  return -electronSemVerCompare(a as semver.SemVer, b as semver.SemVer);
}

/**
 * Sorts Electron versions and returns the result of a map function.
 *
 * @param {Record<string, RunnableVersion?>} versions
 * @param {(key: string, version: RunnableVersion) => void} mapFn
 * @returns {Array<T>}
 */
export function sortedElectronMap<T>(
  versions: Record<string, RunnableVersion>,
  mapFn: (key: string, version: RunnableVersion) => T,
) {
  const map: Map<string | semver.SemVer, RunnableVersion> = new Map(
    Object.entries(versions).map(([key, val]) => [
      semver.parse(key) || key,
      val,
    ]),
  );
  const keys = [...map.keys()].sort(sortByNew);
  return keys.map((key) => {
    const ver = typeof key === 'string' ? key : key.version;
    const run = map.get(key);
    return mapFn(ver, run!);
  });
}
