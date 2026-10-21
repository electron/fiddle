import semver from 'semver';

/**
 * disables download button for versions:
 * - below 11.0.0 on Apple Silicon.
 * - below 6.0.8 and 7.0.0 on Windows arm64
 * - 44.0.0-alpha.4 and above on Windows ia32 and Linux arm (armv7l), which
 *   are no longer published
 * Reference: {@link https://www.electronjs.org/blog/apple-silicon}
 * Reference: {@link https://github.com/electron/electron/blob/main/docs/breaking-changes.md#removed-windows-32-bit-ia32-and-linux-32-bit-arm-armv7l-support}
 *
 * @param version - electron version
 */
export function disableDownload(version: string): boolean {
  return (
    (window.ElectronFiddle.platform === 'darwin' &&
      window.ElectronFiddle.arch === 'arm64' &&
      semver.lt(version, '11.0.0')) ||
    (window.ElectronFiddle.platform === 'win32' &&
      window.ElectronFiddle.arch === 'arm64' &&
      !semver.satisfies(version, '>=6.0.8 || >=7.0.0')) ||
    (((window.ElectronFiddle.platform === 'win32' &&
      window.ElectronFiddle.arch === 'ia32') ||
      (window.ElectronFiddle.platform === 'linux' &&
        window.ElectronFiddle.arch === 'arm')) &&
      semver.gte(version, '44.0.0-alpha.4'))
  );
}
