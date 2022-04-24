import semver from 'semver';

/**
 * disables download button for versions:
 * - below 11.0.0 on Apple Silicon.
 * - below 6.0.8 and 7.0.0 on Windows arm64
 * Reference: {@link https://www.electronjs.org/blog/apple-silicon}
 *
 * @param {string} version - electron version
 * @returns {boolean}
 */
export function disableDownload(version: string) {
  return (
    (process.platform === 'darwin' &&
      process.arch === 'arm64' &&
      semver.lt(version, '11.0.0')) ||
    (process.platform === 'win32' &&
      process.arch === 'arm64' &&
      !semver.satisfies(version, '>=6.0.8 || >=7.0.0'))
  );
}
