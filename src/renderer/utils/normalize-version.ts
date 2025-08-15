/**
 * Removes a possible leading "v" from a version.
 */
export function normalizeVersion(version = ''): string {
  if (version.startsWith('v')) {
    return version.slice(1);
  }

  return version;
}
