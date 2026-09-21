import { parse as semverParse, type SemVer } from 'semver';

export interface ReleaseInfo {
  /** Electron version */
  version: string;
  /** Release date */
  date: string;
  /** Node.js version */
  node: string;
  /** V8 version */
  v8: string;
  /** uv version */
  uv: string;
  /** zlib version */
  zlib: string;
  /** OpenSSL version */
  openssl: string;
  /** Node.js modules version */
  modules: string;
  /** Chromium version */
  chrome: string;
  /** Files included in the release */
  files: Array<string>;
}

function compareVersions(a: SemVer, b: SemVer): number {
  const l = a.compareMain(b);
  if (l) return l;
  // Electron's approach is nightly -> other prerelease tags -> stable,
  // so force `nightly` to sort before other prerelease tags.
  const [prea] = a.prerelease;
  const [preb] = b.prerelease;
  if (prea === 'nightly' && preb !== 'nightly') return -1;
  if (prea !== 'nightly' && preb === 'nightly') return 1;
  return a.comparePre(b);
}

function hasVersion(val: unknown): val is { version: unknown } {
  return typeof val === 'object' && val !== null && 'version' in val;
}

function isReleaseInfo(val: unknown): val is ReleaseInfo {
  return (
    typeof val === 'object' &&
    val !== null &&
    'version' in val &&
    typeof val.version === 'string' &&
    'date' in val &&
    typeof val.date === 'string' &&
    'node' in val &&
    typeof val.node === 'string' &&
    'v8' in val &&
    typeof val.v8 === 'string' &&
    'uv' in val &&
    typeof val.uv === 'string' &&
    'zlib' in val &&
    typeof val.zlib === 'string' &&
    'openssl' in val &&
    typeof val.openssl === 'string' &&
    'modules' in val &&
    typeof val.modules === 'string' &&
    'chrome' in val &&
    typeof val.chrome === 'string' &&
    'files' in val &&
    isArrayOfStrings(val.files)
  );
}

function isArrayOfVersionObjects(val: unknown): val is Array<{ version: string }> {
  return (
    Array.isArray(val) &&
    val.every((item) => hasVersion(item) && typeof item.version === 'string')
  );
}

function isArrayOfStrings(val: unknown): val is Array<string> {
  return Array.isArray(val) && val.every((item) => typeof item === 'string');
}

/**
 * Drops the 0.2x series. Pre-0.24.0 releases were 'atom-shell' and cannot be
 * downloaded with @electron/get, and everything before 0.30.0 (Aug 2015) is
 * unsupported.
 */
function isSupportedVersion({ version }: { version: string }): boolean {
  return !version.startsWith('0.2');
}

const NUM_SUPPORTED_MAJORS = 3;

/**
 * A list of Electron releases, fed to the constructor as the parsed
 * releases.json (or a plain list of version strings).
 */
export class ElectronVersions {
  private readonly map = new Map<string, SemVer>();
  private readonly releaseInfo = new Map<string, ReleaseInfo>();

  public constructor(val: unknown) {
    let parsed: Array<SemVer | null> = [];
    if (isArrayOfVersionObjects(val)) {
      parsed = val.filter(isSupportedVersion).map(({ version }) => semverParse(version));

      for (const entry of val) {
        if (isReleaseInfo(entry) && isSupportedVersion(entry)) {
          this.releaseInfo.set(entry.version, {
            version: entry.version,
            date: entry.date,
            node: entry.node,
            v8: entry.v8,
            uv: entry.uv,
            zlib: entry.zlib,
            openssl: entry.openssl,
            modules: entry.modules,
            chrome: entry.chrome,
            files: [...entry.files],
          });
        }
      }
    } else if (isArrayOfStrings(val)) {
      parsed = val
        .filter((version) => isSupportedVersion({ version }))
        .map((version) => semverParse(version));
    } else {
      console.warn('Unrecognized versions:', val);
    }

    const semvers = parsed.filter((sem): sem is SemVer => Boolean(sem));
    semvers.sort((a, b) => compareVersions(a, b));
    for (const sem of semvers) this.map.set(sem.version, sem);
  }

  /** Semver-Major numbers of branches that have stable releases, in order */
  public get stableMajors(): number[] {
    const majors = new Set<number>();
    for (const ver of this.map.values()) {
      if (ver.prerelease.length === 0) {
        majors.add(ver.major);
      }
    }
    return [...majors];
  }

  /** Semver-Major numbers of branches that have supported stable releases */
  public get supportedMajors(): number[] {
    return this.stableMajors.slice(-NUM_SUPPORTED_MAJORS);
  }

  /** @returns true iff `version` is a release that this object knows about */
  public isVersion(version: string): boolean {
    return this.map.has(version);
  }

  /** @returns {@link ReleaseInfo} iff `version` is a release that this object knows about */
  public getReleaseInfo(version: string): ReleaseInfo | undefined {
    return this.releaseInfo.get(version);
  }
}
