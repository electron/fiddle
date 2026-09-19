/**
 * Linux and MSIX have no auto-update, so they compare the app version with
 * GitHub releases and show an "Update available" notice.
 */
import semver from 'semver';

/** The fields of a GitHub release this app reads. */
export interface GitHubRelease {
  tag_name: string;
  html_url: string;
  draft?: boolean;
  prerelease?: boolean;
}

export interface AvailableUpdate {
  version: string;
  url: string;
}

const RELEASE_PAGE = /^https:\/\/github\.com\/electron\/fiddle\/releases\/tag\/[\w.+-]+$/;

/**
 * The newest stable release above `current`, if any. Drafts and prereleases are
 * skipped. The URL must be a release page on electron/fiddle.
 */
export function pickUpdate(
  releases: readonly GitHubRelease[],
  current: string,
): AvailableUpdate | undefined {
  let best: AvailableUpdate | undefined;
  for (const release of releases) {
    if (release.draft || release.prerelease) continue;
    const version = semver.valid(String(release.tag_name).replace(/^v/, ''));
    if (!version || !RELEASE_PAGE.test(String(release.html_url))) continue;
    if (semver.prerelease(version)) continue;
    if (!semver.gt(version, current)) continue;
    if (!best || semver.gt(version, best.version))
      best = { version, url: release.html_url };
  }
  return best;
}
