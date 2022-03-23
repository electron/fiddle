import semver from 'semver';
import { isJest } from './is-jest';

export function disableDownload(version: string) {
  return (
    !isJest() &&
    process.platform === 'darwin' &&
    process.arch === 'arm64' &&
    semver.lt(version, '11.0.0')
  );
}
