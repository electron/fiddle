import semver from 'semver';

export function disableDownload(version: string) {
  return (
    !process.env.JEST &&
    process.platform === 'darwin' &&
    process.arch === 'arm64' &&
    semver.lt(version, '11.0.0')
  );
}
