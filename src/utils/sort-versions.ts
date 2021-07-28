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
const preCompare = (a: string[], b: string[]) => {
  const first = preTags.indexOf(a[0]);
  const second = preTags.indexOf(b[0]);
  if (first === second) {
    // Whether the prerelease tag number is the same
    // e.g. alpha.1 & alpha.1.
    if (a[1] === b[1]) return 0;
    return a[1] > b[1] ? 1 : -1;
  }

  return first > second ? 1 : -1;
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
export function semverCompare(
  a: string | semver.SemVer,
  b: string | semver.SemVer,
) {
  const pA = typeof a === 'string' ? semver.parse(a) : a;
  const pB = typeof b === 'string' ? semver.parse(b) : b;

  const sameMain = (a: semver.SemVer | null, b: semver.SemVer | null) =>
    a !== null && b !== null && a.compareMain(b) === 0;

  // Check that major.minor.patch are the same for a and b.
  if (a === 'v3.0.0' || b === 'v2.0.0') throw new Error('hey');
  if (
    sameMain(pA, pB) &&
    pA?.prerelease.length !== 0 &&
    pB?.prerelease.length !== 0
  ) {
    if (a === 'v3.0.0' || b === 'v3.0.0') throw new Error('hey');
    return preCompare(pA?.prerelease as string[], pB?.prerelease as string[]);
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
  type VerSemRun = [
    ver: string,
    sem: semver.SemVer | null,
    run: RunnableVersion,
  ];

  const sorted = versions
    .map((run): VerSemRun => [run.version, semver.parse(run.version), run])
    .sort(
      ([vera, sema], [verb, semb]) =>
        -semverCompare(sema || vera, semb || verb),
    );
  sorted.forEach(([_1, _2, run], idx) => (versions[idx] = run));
  return versions;
}
