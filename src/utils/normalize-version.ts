/**
 * Removes a possible leading "v" from a version.
 *
 * @param {string} version
 * @returns {string}
 */
export function normalizeVersion(version: string = ''): string {
  if (version.startsWith('v')) {
    return version.slice(1);
  } else {
    return version;
  }
}
