import { ElectronVersion } from '../interfaces';
import { normalizeVersion } from './normalize-version';

/**
 * Takes an array of GitHub releases and returns a StringMap of
 * Electron releases.
 *
 * @param {Array<ElectronVersion>} input
 * @returns {Record<string, ElectronVersion>}
 */
export function arrayToStringMap(
  input: Array<ElectronVersion>
): Record<string, ElectronVersion> {
  const output = {};

  input.forEach((version) => {
    const versionNumber = normalizeVersion(version.version);
    output[versionNumber] = version;
  });

  return output;
}
