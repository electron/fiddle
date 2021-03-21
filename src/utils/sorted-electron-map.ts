import * as semver from 'semver';

import { RunnableVersion } from '../interfaces';

// Electron's approach is nightly -> beta -> stable,
// so account for 'beta' coming before 'nightly' lexicographically
function electronSemVerCompare(a: semver.SemVer, b: semver.SemVer) {
  const l = a.compareMain(b);
  if (l) return l;
  if (a.prerelease[0] === 'nightly' && b.prerelease[0] === 'beta') return -1;
  if (a.prerelease[0] === 'beta' && b.prerelease[0] === 'nightly') return 1;
  return a.comparePre(b);
}

interface SemRun {
  sem: semver.SemVer | null;
  runnable: RunnableVersion;
}

// non-semver goes first, sorted lexicographically
// then semver, sorted newest-to-oldest
function compareSemRunByNew(a: SemRun, b: SemRun) {
  if (!a.sem && !b.sem)
    return a.runnable.version.localeCompare(b.runnable.version);
  if (!a.sem) return -1;
  if (!b.sem) return 1;
  return -electronSemVerCompare(a.sem!, b.sem!);
}

/**
 * Returns a new sorted array of RunnableVersions
 *
 * @param {Array<RunnableVersion>} versions - unsorted
 * @returns {Array<RunnableVersion>}
 */
function sortByNew(versions: RunnableVersion[]): RunnableVersion[] {
  return versions
    .map((runnable) => ({
      runnable,
      sem: semver.parse(runnable?.version),
    }))
    .sort(compareSemRunByNew)
    .map(({ runnable }) => runnable);
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
  const runnables = Object.values(versions).filter((r) => r);
  const sorted = sortByNew(runnables);
  return sorted.map((runnable) => mapFn(runnable.version, runnable));
}
