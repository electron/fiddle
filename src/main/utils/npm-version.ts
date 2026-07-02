import semver from 'semver';

/**
 * Fetches the latest version of an npm package matching a given major version.
 *
 * @param packageName - the npm package name (e.g. '\@types/node')
 * @param major - the major version to match against
 * @returns the latest version string matching the major version
 */
export async function getLatestMajorVersion(
  packageName: string,
  major: number,
): Promise<string> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
  const headers: HeadersInit = {
    Accept: 'application/vnd.npm.install-v1+json',
  };
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`npm registry returned ${res.status}`);

  const data = (await res.json()) as { versions: Record<string, unknown> };
  const matched = semver.maxSatisfying(Object.keys(data.versions), `${major}`);
  if (!matched)
    throw new Error(
      `No ${packageName} version found for major version ${major}`,
    );

  return matched;
}
