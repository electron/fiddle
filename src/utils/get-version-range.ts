import * as semver from 'semver';

import { RunnableVersion } from '../interfaces';

/**
 * An subset of 'versions' bounded in the range of [oldVersion..newVersion] and sorted from oldest to newest.
 *
 * @export
 * @param {string} oldVersion
 * @param {string} newVersion
 * @returns {RunnableVersion[] | null}
 */
export function getVersionRange(
  oldVersion: string,
  newVersion: string,
  versions: RunnableVersion[]
): RunnableVersion[] | null {
  // ensure that oldVersion is old than newVersion
  if (semver.compare(oldVersion, newVersion) > 0) {
    [oldVersion, newVersion] = [newVersion, oldVersion]
  }

  const oldIdx = versions.findIndex((v) => v.version === oldVersion);
  if (oldIdx === -1) {
    this.appState.pushOutput(`Bisect: Version not found: ${oldVersion}`);
    return null;
  }

  const newIdx = versions.findIndex((v) => v.version === newVersion);
  if (newIdx === -1) {
    this.appState.pushOutput(`Bisect: Version not found: ${newVersion}`);
    return null;
  }

  versions = versions.slice(Math.min(oldIdx,newIdx), Math.max(oldIdx,newIdx)+1);

  if (oldIdx > newIdx) {
    versions.reverse();
  }

  return versions;
}
