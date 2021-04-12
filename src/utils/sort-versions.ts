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

function compare(a: semver.SemVer | string, b: semver.SemVer | string) {
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
    .sort(([vera, sema], [verb, semb]) => compare(sema || vera, semb || verb));
  sorted.forEach(([_1, _2, run], idx) => (versions[idx] = run));
  return versions;
}
