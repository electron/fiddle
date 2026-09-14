/**
 * Release list rows (§17.8): newest first, with obsolete and platform flags,
 * and the version picker's list. Pure; no Electron imports.
 */
import {
  getOldestSupportedMajor,
  getReleaseChannel,
  isObsolete,
  isSupportedOnPlatform,
  sortVersions,
} from '../../fiddle/versions';
import type { Settings } from '../../shared/settings';
import type { LocalBuild, ReleaseRow, VersionRefValue, VersionsState } from '../../shared/stores';

export type VersionFilterSettings = Pick<Settings, 'channels' | 'showObsolete' | 'showNotDownloaded'>;

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

// ---------------------------------------------------------------------------
// The version picker.

/** A version's install state in the picker, or why it can't be picked. */
export type PickerState =
  | 'missing'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'installed'
  | 'unsupported'
  | 'local'
  | 'localMissing';

export interface PickerEntry {
  /** `r:<version>` or `l:<build id>`. */
  id: string;
  kind: 'release' | 'local';
  /** The release number, or the local build's name. */
  label: string;
  state: PickerState;
  /** 0–100 while downloading. */
  percent?: number;
  /** The design's right-aligned hint. */
  hint?: 'latest' | 'beta' | 'nightly';
  /** Releases this computer can't run, and local builds whose binary is gone. */
  disabled: boolean;
}

export interface PickerGroup {
  /** `results` is the one flat list shown while searching. */
  key: 'local' | 'stable' | 'prerelease' | 'results';
  entries: PickerEntry[];
}

export interface PickerInput {
  rows: readonly ReleaseRow[];
  settings: VersionFilterSettings;
  installs: VersionsState['installs'];
  localBuilds: readonly LocalBuild[];
  /** The window's version: always listed. */
  current?: VersionRefValue | undefined;
  query?: string;
}

const isStable = (version: string) => !version.includes('-');

/** A release search as typed: case-insensitive, and "Electron 43" or "v43" find 43.x. */
export function normalizeVersionQuery(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .replace(/^electron\s*/, '')
    .replace(/^v(?=\d)/, '');
}

function releaseEntry(
  row: ReleaseRow,
  install: VersionsState['installs'][string] | undefined,
  latest: string | undefined,
): PickerEntry {
  const channel = getReleaseChannel(row.version);
  const hint = row.version === latest ? 'latest' : channel === 'stable' ? undefined : channel;
  return {
    id: `r:${row.version}`,
    kind: 'release',
    label: row.version,
    state: row.supported ? (install?.state ?? 'missing') : 'unsupported',
    ...(row.supported && install?.state === 'downloading' ? { percent: install.percent ?? 0 } : {}),
    ...(hint ? { hint } : {}),
    disabled: !row.supported,
  };
}

function localEntry(build: LocalBuild): PickerEntry {
  return {
    id: `l:${build.id}`,
    kind: 'local',
    label: build.name,
    state: build.available ? 'local' : 'localMissing',
    disabled: !build.available,
  };
}

/**
 * The picker's list (§17.8): local builds first, then releases newest first
 * (within one x.y.z, nightly < alpha < beta < stable). Releases follow the
 * version settings as elsewhere, but ones this computer can't run stay
 * listed, disabled. Without a search the design's groups stay (local builds,
 * Stable, Pre-release), each newest first; a search drops them for one flat
 * list, so the newest match is always on top.
 */
export function pickerGroups({
  rows,
  settings,
  installs,
  localBuilds,
  current,
  query = '',
}: PickerInput): PickerGroup[] {
  const keep = current?.kind === 'release' ? current.version : undefined;
  const typed = query.trim().toLowerCase();
  const needle = normalizeVersionQuery(query);
  const sorted = sortVersions(rows);
  const latest = sorted.find((row) => row.supported && isStable(row.version))?.version;
  const releases = sorted
    .filter(
      (row) =>
        row.version === keep ||
        (settings.channels.includes(getReleaseChannel(row.version)) &&
          (settings.showObsolete || !row.obsolete) &&
          (settings.showNotDownloaded || installs[row.version]?.state === 'installed')),
    )
    .filter((row) => row.version.toLowerCase().includes(needle))
    .map((row) => releaseEntry(row, installs[row.version], latest));
  const local = localBuilds.filter((build) => build.name.toLowerCase().includes(typed)).map(localEntry);

  const groups: PickerGroup[] = typed
    ? [{ key: 'results', entries: [...local, ...releases] }]
    : [
        { key: 'local', entries: local },
        { key: 'stable', entries: releases.filter((entry) => isStable(entry.label)) },
        { key: 'prerelease', entries: releases.filter((entry) => !isStable(entry.label)) },
      ];
  return groups.filter((group) => group.entries.length > 0);
}
