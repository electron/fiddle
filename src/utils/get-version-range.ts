import { RunnableVersion } from '../interfaces';
import { semverCompare } from './sort-versions';

/**
 * An subset of `versions` sorted from oldest to newest and bounded in the range of [oldVersion..newVersion]
 *
 * @export
 * @param {string} oldVersion - first version to keep
 * @param {string} newVersion - last version to keep
 * @param {RunnableVersion[]} versions - the versions to make a subset of
 * @returns {RunnableVersion[]}
 */
export function getVersionRange(
  oldVersion: string,
  newVersion: string,
  versions: RunnableVersion[],
): RunnableVersion[] {
  // ensure that oldVersion is old than newVersion
  if (semverCompare(oldVersion, newVersion) > 0) {
    [oldVersion, newVersion] = [newVersion, oldVersion];
  }

  const oldIdx = versions.findIndex((v) => v.version === oldVersion);
  if (oldIdx === -1) {
    console.warn(`getVersionRange: Version not found: ${oldVersion}`);
    return [];
  }

  const newIdx = versions.findIndex((v) => v.version === newVersion);
  if (newIdx === -1) {
    console.warn(`getVersionRange: Version not found: ${newVersion}`);
    return [];
  }

  versions = versions.slice(
    Math.min(oldIdx, newIdx),
    Math.max(oldIdx, newIdx) + 1,
  );

  if (oldIdx > newIdx) {
    versions.reverse();
  }

  return versions;
}
