import * as semver from 'semver';

export const RELEASE_CHANNELS = ['stable', 'beta', 'nightly'] as const;
export type ReleaseChannel = (typeof RELEASE_CHANNELS)[number];

type Versioned = string | { version: string };

function versionOf(item: Versioned): string {
  return typeof item === 'string' ? item : item.version;
}

/** alpha and beta → beta, nightly → nightly, everything else → stable. */
export function getReleaseChannel(version: string): ReleaseChannel {
  if (version.includes('alpha') || version.includes('beta')) return 'beta';
  if (version.includes('nightly')) return 'nightly';
  return 'stable';
}

const PRE_TAGS = ['nightly', 'alpha', 'beta'];

function tier(v: semver.SemVer): number {
  if (v.prerelease.length === 0) return PRE_TAGS.length;
  return PRE_TAGS.indexOf(String(v.prerelease[0]));
}

/**
 * Ascending comparator. Within the same x.y.z: nightly < alpha < beta < stable.
 * Non-semver strings (local builds) sort below every release.
 */
export function compareVersions(a: string, b: string): number {
  const pa = semver.parse(a);
  const pb = semver.parse(b);
  if (pa && pb) {
    const main = pa.compareMain(pb);
    if (main !== 0) return main;
    const byTier = tier(pa) - tier(pb);
    if (byTier !== 0) return Math.sign(byTier);
    return pa.comparePre(pb);
  }
  if (pa) return 1;
  if (pb) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Newest first by {@link compareVersions}, so non-semver versions go last. Returns a new array. */
export function sortVersions<T extends Versioned>(items: readonly T[]): T[] {
  return [...items].sort((x, y) => compareVersions(versionOf(y), versionOf(x)));
}

export function isObsolete(version: string, oldestSupportedMajor: number): boolean {
  const parsed = semver.parse(version);
  return parsed !== null && parsed.major < oldestSupportedMajor;
}

/**
 * The oldest supported major: the first of `supportedMajors`, unless
 * `NUM_STABLE_BRANCHES=N` asks for the last N stable majors instead.
 */
export function getOldestSupportedMajor(input: {
  stableMajors: readonly number[];
  supportedMajors: readonly number[];
  numStableBranches?: string;
}): number | undefined {
  const n = Number.parseInt(input.numStableBranches ?? '', 10);
  if (Number.isInteger(n) && n > 0) return input.stableMajors.slice(-n)[0];
  return input.supportedMajors[0];
}

export interface VersionFilter {
  channels: readonly ReleaseChannel[];
  showObsolete: boolean;
  oldestSupportedMajor?: number;
  showNotDownloaded: boolean;
  isDownloaded?: (version: string) => boolean;
  /** Always kept, such as the current version. */
  keep?: readonly string[];
}

export function filterVersions<T extends Versioned>(items: readonly T[], filter: VersionFilter): T[] {
  return items.filter((item) => {
    const version = versionOf(item);
    if (filter.keep?.includes(version)) return true;
    if (!filter.channels.includes(getReleaseChannel(version))) return false;
    if (!filter.showObsolete && filter.oldestSupportedMajor !== undefined && isObsolete(version, filter.oldestSupportedMajor)) {
      return false;
    }
    if (!filter.showNotDownloaded && !(filter.isDownloaded?.(version) ?? false)) return false;
    return true;
  });
}

/**
 * False for releases this platform can't run: macOS arm64 needs 11 or later,
 * Windows arm64 needs 6.0.8 or later. Non-semver versions pass.
 */
export function isSupportedOnPlatform(version: string, platform: string, arch: string): boolean {
  if (!semver.valid(version) || arch !== 'arm64') return true;
  if (platform === 'darwin') return !semver.lt(version, '11.0.0');
  if (platform === 'win32') return semver.satisfies(version, '>=6.0.8', { includePrerelease: true });
  return true;
}

/** Suggests a local build's name from its path: `.../gn/main/src/out/testing` → `gn/main - testing`. */
export function suggestLocalBuildName(folder: string): string {
  const tokens = folder.split(/[/\\]+/).filter(Boolean);
  const buildType = tokens.pop() ?? '';
  // Drop `src/out`, which every build has, then keep about 20 characters of the rest.
  const leader = tokens
    .slice(0, -2)
    .join('/')
    .slice(-20 + buildType.length)
    .split('/')
    .slice(1)
    .join('/');
  return leader ? `${leader} - ${buildType}` : buildType;
}

/** Releases from `from` to `to` inclusive, oldest first. Empty unless both are semver releases in `versions`. */
export function getVersionRange(from: string, to: string, versions: readonly string[]): string[] {
  if (!semver.valid(from) || !semver.valid(to) || !versions.includes(from) || !versions.includes(to)) return [];
  const [lo, hi] = compareVersions(from, to) <= 0 ? [from, to] : [to, from];
  return versions
    .filter((v) => semver.valid(v) && compareVersions(v, lo) >= 0 && compareVersions(v, hi) <= 0)
    .sort(compareVersions);
}

/** Bisect defaults from the visible releases (newest first): the 11th as good, the newest as bad. Local builds are skipped. */
export function getDefaultBisectRange(visible: readonly string[]): { good: string; bad: string } | undefined {
  const releases = visible.filter((v) => semver.valid(v));
  if (releases.length < 2) return undefined;
  return { good: releases[Math.min(10, releases.length - 1)]!, bad: releases[0]! };
}
