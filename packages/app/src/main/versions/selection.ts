import type { VersionRef } from '../../fiddle/fiddle';
import { getReleaseChannel, type ReleaseChannel } from '../../fiddle/versions';
import type { LocalBuild, ReleaseRow } from '../../shared/stores';
import { visibleVersions, type VersionFilterSettings } from './releases';

export interface VersionLookup {
  release(version: string): ReleaseRow | undefined;
  localBuild(id: string): LocalBuild | undefined;
}

/** Why a window can't use a version. */
export type VersionProblem = 'unknown' | 'unsupported' | 'localUnknown' | 'localMissing';

/** Undefined when it's a release this computer can run, or a local build with its binary. */
export function versionProblem(
  ref: VersionRef,
  lookup: VersionLookup,
): VersionProblem | undefined {
  if (ref.kind === 'local') {
    const build = lookup.localBuild(ref.id);
    if (!build) return 'localUnknown';
    return build.available ? undefined : 'localMissing';
  }
  const row = lookup.release(ref.version);
  if (!row) return 'unknown';
  return row.supported ? undefined : 'unsupported';
}

export function sameVersion(a: VersionRef, b: VersionRef): boolean {
  return a.kind === 'release'
    ? b.kind === 'release' && a.version === b.version
    : b.kind === 'local' && a.id === b.id;
}

export interface VersionCatalog {
  rows: readonly ReleaseRow[];
  localBuilds: readonly LocalBuild[];
  settings: VersionFilterSettings;
  isInstalled(version: string): boolean;
}

/**
 * Available local builds, then the visible releases newest first, then any
 * other release this computer can run. `installedOnly` is for a failed
 * download: another would likely fail too.
 */
export function firstUsableVersion(
  catalog: VersionCatalog,
  options: { installedOnly?: boolean; exclude?: VersionRef } = {},
): VersionRef | undefined {
  const { installedOnly = false, exclude } = options;
  const allowed = (ref: VersionRef) => !exclude || !sameVersion(ref, exclude);
  for (const build of catalog.localBuilds) {
    const ref: VersionRef = { kind: 'local', id: build.id };
    if (build.available && allowed(ref)) return ref;
  }
  const visible = visibleVersions(catalog.rows, catalog.settings, (version) =>
    catalog.isInstalled(version),
  );
  const runnable = catalog.rows.filter((row) => row.supported).map((row) => row.version);
  for (const version of [...visible, ...runnable]) {
    const ref: VersionRef = { kind: 'release', version };
    if (allowed(ref) && (!installedOnly || catalog.isInstalled(version))) return ref;
  }
  return undefined;
}

/** The last version the user picked while it's still usable, else the latest stable release this computer can run. */
export function defaultVersionFor(
  rows: readonly ReleaseRow[],
  last: VersionRef | undefined,
  lookup: VersionLookup,
): VersionRef | undefined {
  if (last && !versionProblem(last, lookup)) return last;
  const runnable = rows.filter((row) => row.supported);
  const latest =
    runnable.find((row) => getReleaseChannel(row.version) === 'stable') ?? runnable[0];
  return latest ? { kind: 'release', version: latest.version } : undefined;
}

/** The release channel of `version` when the settings hide it, else undefined. */
export function hiddenChannel(
  version: string,
  channels: readonly ReleaseChannel[],
): ReleaseChannel | undefined {
  const channel = getReleaseChannel(version);
  return channels.includes(channel) ? undefined : channel;
}
