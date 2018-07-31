import { ElectronVersion, GitHubVersion } from '../interfaces';
import { normalizeVersion } from './normalize-version';

/**
 * Takes an array of GitHub releases and returns a StringMap of
 * Electron releases.
 *
 * @param {Array<GitHubVersion>} input
 * @returns {Record<string, ElectronVersion>}
 */
export function arrayToStringMap(
  input: Array<GitHubVersion>
): Record<string, ElectronVersion> {
  const output = {};

  input.forEach((version) => {
    const versionNumber = normalizeVersion(version.tag_name);
    output[versionNumber] = version;
    output[versionNumber].state = 'unknown';
  });

  return output;
}
