import { semverCompare } from './sort-versions';
import { RunnableVersion } from '../../interfaces';

/**
 * An subset of `versions` sorted from oldest to newest and bounded in the range of [oldVersion..newVersion]
 *
 * @param oldVersion - first version to keep
 * @param newVersion - last version to keep
 * @param versions - the versions to make a subset of
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
