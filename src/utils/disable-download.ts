import semver from 'semver';
import { isJest } from './is-jest';

/**
 * disables download button for versions below 11.0.0 on Apple Silicon.
 * Reference: {@link https://www.electronjs.org/blog/apple-silicon}
 *
 * @param {string} version
 * @returns {boolean}
 */

export function disableDownload(version: string) {
  return (
    !isJest() &&
    process.platform === 'darwin' &&
    process.arch === 'arm64' &&
    semver.lt(version, '11.0.0')
  );
}
