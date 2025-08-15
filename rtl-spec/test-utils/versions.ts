import {
  ElectronReleaseChannel,
  InstallState,
  VersionSource,
} from '../../src/interfaces';
import { VersionsMock } from '../../tests/mocks/electron-versions';
import { StateMock } from '../../tests/mocks/state';

const { missing } = InstallState;
const { remote } = VersionSource;

export const mockVersion1 = {
  source: remote,
  state: missing,
  version: '26.0.0',
};

export const mockVersion2 = {
  source: remote,
  state: missing,
  version: '28.0.0-unsupported',
};

/**
 * Initializes the app state with our mock versions.
 */
export function prepareAppState() {
  const { state: appState } = window.app;

  const { mockVersions } = new VersionsMock();

  (appState as unknown as StateMock).initVersions('2.0.2', {
    ...mockVersions,
    [mockVersion1.version]: { ...mockVersion1 },
    [mockVersion2.version]: { ...mockVersion2 },
  });

  appState.channelsToShow = [
    ElectronReleaseChannel.stable,
    ElectronReleaseChannel.beta,
  ];

  return appState;
}
