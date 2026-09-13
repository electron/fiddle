/**
 * Update decisions that don't need Electron, so they are unit-tested:
 *
 * - The kill switch (REQUIREMENTS §13): `update-policy.json` holds
 *   `{ blockedVersions, minVersion, message }`. `blockedVersions` entries are
 *   exact versions or semver ranges. A version below `minVersion` is blocked too.
 * - Linux and MSIX have no auto-update, so they compare the app version with
 *   GitHub releases and show an "Update available" notice.
 */
import semver from 'semver';
import { z } from 'zod';

const updatePolicySchema = z.object({
  blockedVersions: z.array(z.string().max(100)).max(1000).default([]),
  minVersion: z.string().max(100).optional(),
  message: z.string().max(1000).optional(),
});
type UpdatePolicy = z.infer<typeof updatePolicySchema>;

/** Parses the fetched JSON. Returns undefined when it isn't a valid policy. */
export function parsePolicy(data: unknown): UpdatePolicy | undefined {
  const result = updatePolicySchema.safeParse(data);
  return result.success ? result.data : undefined;
}

interface PolicyVerdict {
  blocked: boolean;
  /** The policy's message, shown in the blocking notice. */
  message?: string;
}

/** Whether `version` may run under `policy`. Invalid entries are ignored. */
export function evaluatePolicy(policy: UpdatePolicy, version: string): PolicyVerdict {
  const current = semver.valid(version.replace(/^v/, ''));
  if (!current) return { blocked: false };
  const options = { includePrerelease: true };
  const listed = policy.blockedVersions.some((entry) => {
    const range = semver.validRange(entry.replace(/^v/, ''), options);
    return range !== null && semver.satisfies(current, range, options);
  });
  const min = policy.minVersion ? semver.valid(policy.minVersion.replace(/^v/, '')) : null;
  const tooOld = min !== null && semver.lt(current, min);
  return listed || tooOld ? { blocked: true, message: policy.message } : { blocked: false };
}

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
 * The newest release above `current`, if any. Drafts are skipped, and
 * prereleases unless `includePrerelease`. The URL must be a release page on
 * electron/fiddle.
 */
export function pickUpdate(
  releases: readonly GitHubRelease[],
  current: string,
  includePrerelease: boolean,
): AvailableUpdate | undefined {
  let best: AvailableUpdate | undefined;
  for (const release of releases) {
    if (release.draft || (release.prerelease && !includePrerelease)) continue;
    const version = semver.valid(String(release.tag_name).replace(/^v/, ''));
    if (!version || !RELEASE_PAGE.test(String(release.html_url))) continue;
    if (!includePrerelease && semver.prerelease(version)) continue;
    if (!semver.gt(version, current)) continue;
    if (!best || semver.gt(version, best.version)) best = { version, url: release.html_url };
  }
  return best;
}
