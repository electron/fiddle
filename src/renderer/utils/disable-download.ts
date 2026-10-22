import semver from 'semver';

const lastIa32AndArmv7lVersion = '44.0.0-alpha.3';

/**
 * Rules for Electron versions that have no build for a platform and
 * architecture. Combinations without a rule can download any version.
 */
const unavailableVersions: Partial<
  Record<string, (version: string) => boolean>
> = {
  // Apple Silicon builds start with 11.0.0.
  // Reference: {@link https://www.electronjs.org/blog/apple-silicon}
  'darwin-arm64': (version) => semver.lt(version, '11.0.0'),
  // Windows arm64 builds start with 6.0.8.
  'win32-arm64': (version) => !semver.satisfies(version, '>=6.0.8 || >=7.0.0'),
  // Windows ia32 and Linux armv7l builds are no longer published after
  // 44.0.0-alpha.3.
  // Reference: {@link https://github.com/electron/electron/blob/main/docs/breaking-changes.md#removed-windows-32-bit-ia32-and-linux-32-bit-arm-armv7l-support}
  'win32-ia32': (version) => semver.gt(version, lastIa32AndArmv7lVersion),
  'linux-arm': (version) => semver.gt(version, lastIa32AndArmv7lVersion),
};

/**
 * Whether the download button is disabled for an Electron version, because
 * no build of it exists for the current platform and architecture.
 *
 * @param version - electron version
 */
export function disableDownload(version: string): boolean {
  const { platform, arch } = window.ElectronFiddle;
  return unavailableVersions[`${platform}-${arch}`]?.(version) ?? false;
}
