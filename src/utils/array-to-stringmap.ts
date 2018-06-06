import { normalizeVersion } from "./normalize-version";
import { GitHubVersion, StringMap, ElectronVersion } from "../interfaces";

export function arrayToStringMap(input: Array<GitHubVersion>): StringMap<ElectronVersion> {
  const output = {};

  input.forEach((version) => {
    const versionNumber = normalizeVersion(version.tag_name);
    output[versionNumber] = version;
    output[versionNumber].state = 'unknown';
  });

  return output;
}
