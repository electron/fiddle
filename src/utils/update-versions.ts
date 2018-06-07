import { ElectronVersion, StringMap, ElectronVersionState } from '../interfaces';

export function updateVersionState(
  versions: StringMap<ElectronVersion>, version: string, state: ElectronVersionState
) {
  const updatedVersion = {
    ...versions[version],
    state
  };

  const updatedVersions = { ...versions };
  updatedVersions[version] = updatedVersion;

  return updatedVersions;
}
