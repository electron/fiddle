export function normalizeVersion(version: string) {
  if (version.startsWith('v')) {
    return version.slice(1);
  } else {
    return version;
  }
}
