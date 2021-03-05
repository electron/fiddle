import semver from 'semver';

/**
 * Removes a possible leading "v" from a version.
 */
export function normalizeVersion(version: string) {
  return semver.clean(version) ?? version;
}
