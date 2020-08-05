import { RunnableVersion } from '../interfaces';
import { normalizeVersion } from './normalize-version';

/**
 * Takes an array of GitHub releases and returns a StringMap of
 * Electron releases.
 *
 * @param {Array<RunnableVersion>} input
 * @returns {Record<string, RunnableVersion>}
 */
export function arrayToStringMap(
  input: Array<RunnableVersion>,
): Record<string, RunnableVersion> {
  const output = {};

  input.forEach((version) => {
    const versionNumber = normalizeVersion(version.version);
    output[versionNumber] = version;
  });

  return output;
}
