import * as semver from 'semver';

import { RunnableVersion } from '../interfaces';

const preTags = ['nightly', 'alpha', 'beta'];

/**
 * Sorts prerelease tags such that nightly -> alpha -> beta.
 *
 * @param a Prerelease tag data for the old version.
 * @param b Prerelease tag data for the new version.
 * @returns 0 | 1 | -1
 */
const preCompare = (
  a: readonly (string | number)[],
  b: readonly (string | number)[],
) => {
  const one = preTags.indexOf(a[0] as string);
  const two = preTags.indexOf(b[0] as string);
  if (one === two) {
    // Whether the prerelease tag number is the same
    // e.g. alpha.1 & alpha.1.
    if (a[1] === b[1]) return 0;
    return a[1] > b[1] ? 1 : -1;
  }

  return one > two ? 1 : -1;
};

/**
 * Custom semver comparator which takes into account Electron's prerelease
 * tag hierarchy.
 *
 * Sorts in ascending order when passed to Array.sort().
 *
 * @param a The old Electron version.
 * @param b The new Electron version.
 * @returns 0 | 1 | -1
 */
export function semverCompare(a: string, b: string) {
  const hasPre = (v: string) => preTags.some((tag) => v.includes(tag));

  // Check that major.minor.patch are the same for a and b.
  if (semver.coerce(a)?.raw === semver.coerce(b)?.raw) {
    if (hasPre(a) && hasPre(b)) {
      const { prerelease: aPre } = semver.parse(a) as semver.SemVer;
      const { prerelease: bPre } = semver.parse(b) as semver.SemVer;
      return preCompare(aPre, bPre);
    }
  }

  return semver.compare(a, b);
}

/**
 * Inplace sorting of Versions
 *
 * @param {RunnableVersion[]} versions
 * @returns {RunnableVersion[]}
 */
export function sortVersions(versions: RunnableVersion[]): RunnableVersion[] {
  type VerSemRun = [ver: string, run: RunnableVersion];

  const filtered = versions.filter((runnable) =>
    semver.valid(runnable.version),
  );
  const sorted = filtered
    .map((run): VerSemRun => [run.version, run])
    .sort(([vera], [verb]) => -semverCompare(vera, verb));
  sorted.forEach(([_1, run], idx) => (filtered[idx] = run));

  return filtered;
}
