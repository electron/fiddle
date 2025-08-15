import semver from 'semver';

/**
 * disables download button for versions:
 * - below 11.0.0 on Apple Silicon.
 * - below 6.0.8 and 7.0.0 on Windows arm64
 * Reference: {@link https://www.electronjs.org/blog/apple-silicon}
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
      !semver.satisfies(version, '>=6.0.8 || >=7.0.0'))
  );
}
