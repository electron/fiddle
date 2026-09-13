/**
 * Release list rows (§17.8): newest first, with obsolete and platform flags.
 * Pure; no Electron imports.
 */
import {
  getOldestSupportedMajor,
  getReleaseChannel,
  isObsolete,
  isSupportedOnPlatform,
  sortVersions,
} from '../../fiddle/versions';
import type { Settings } from '../../shared/settings';
import type { ReleaseRow } from '../../shared/stores';

type VersionFilterSettings = Pick<Settings, 'channels' | 'showObsolete' | 'showNotDownloaded'>;

/**
 * The versions the user sees (§17.8): runnable here, in a chosen channel, not
 * obsolete unless asked, and downloaded if "not downloaded" versions are hidden.
 * `keep` (the current version) always stays.
 */
export function visibleVersions(
  rows: readonly ReleaseRow[],
  settings: VersionFilterSettings,
  isInstalled: (version: string) => boolean,
  keep: readonly string[] = [],
): string[] {
  return rows
    .filter(
      (row) =>
        keep.includes(row.version) ||
        (row.supported &&
          settings.channels.includes(getReleaseChannel(row.version)) &&
          (settings.showObsolete || !row.obsolete) &&
          (settings.showNotDownloaded || isInstalled(row.version))),
    )
    .map((row) => row.version);
}

interface RawRelease {
  version: string;
  date?: unknown;
  node?: unknown;
}

function isRawRelease(value: unknown): value is RawRelease {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as RawRelease).version === 'string'
  );
}

/** True if `data` looks like releases.json: a non-empty array of `{ version }`. */
export function isReleaseList(data: unknown): data is RawRelease[] {
  return Array.isArray(data) && data.length > 0 && data.every(isRawRelease);
}

interface RowOptions {
  stableMajors: readonly number[];
  supportedMajors: readonly number[];
  platform: string;
  arch: string;
  /** `NUM_STABLE_BRANCHES`, if set. */
  numStableBranches?: string;
}

export function toReleaseRows(data: readonly RawRelease[], options: RowOptions): ReleaseRow[] {
  const oldest = getOldestSupportedMajor(options);
  const rows = data.map((entry) => ({
    version: entry.version.replace(/^v/, ''),
    date: typeof entry.date === 'string' ? entry.date : '',
    node: typeof entry.node === 'string' ? entry.node : '',
    obsolete: oldest !== undefined && isObsolete(entry.version, oldest),
    supported: isSupportedOnPlatform(entry.version, options.platform, options.arch),
  }));
  return sortVersions(rows);
}
