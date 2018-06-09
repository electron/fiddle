import { normalizeVersion } from './normalize-version';
import { GitHubVersion, StringMap, ElectronVersion } from '../interfaces';

/**
 * Takes an array of GitHub releases and returns a StringMap of
 * Electron releases.
 *
 * @param {Array<GitHubVersion>} input
 * @returns {StringMap<ElectronVersion>}
 */
export function arrayToStringMap(input: Array<GitHubVersion>): StringMap<ElectronVersion> {
  const output = {};

  input.forEach((version) => {
    const versionNumber = normalizeVersion(version.tag_name);
    output[versionNumber] = version;
    output[versionNumber].state = 'unknown';
  });

  return output;
}
